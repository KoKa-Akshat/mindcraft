import Foundation

/// Step 1 of the Bar Exam Pilot's bootstrapping pipeline ("The Bar Exam
/// Pilot" memo, §3.1/§3.6) — the ChatGPT `conversations.json` parser.
/// Deliberately scoped to exactly this: reconstruct real threads with real
/// timestamps, locally, with no MindCraft dependency and no network call.
/// Classification (§3.2), the review UI (§3.3), and event-seeding (§3.4,
/// needs Blake) are explicitly NOT part of this file — the memo's own build
/// order says steps 1-3 are safe to build ahead of the open architecture
/// questions; this is only step 1, on purpose, given how much else shipped
/// tonight.
///
/// Format-drift defense (memo §3.1): this export format is undocumented and
/// has changed before. Every decode failure produces a specific,
/// human-readable reason instead of silently returning an empty or
/// partially-wrong result — "fail loudly and specifically," not "assume the
/// shape and hope."
enum ChatHistoryImportError: Error, LocalizedError, Equatable {
    case notAnArray
    case emptyExport
    case conversationMissingCurrentNode(index: Int)
    case currentNodeNotInMapping(index: Int, nodeId: String)
    case cycleDetected(index: Int)

    var errorDescription: String? {
        switch self {
        case .notAnArray:
            return "This doesn't look like a ChatGPT conversations.json export - expected a top-level array."
        case .emptyExport:
            return "The export contained zero conversations."
        case .conversationMissingCurrentNode(let i):
            return "Conversation \(i) has no current_node - the export format may have changed."
        case .currentNodeNotInMapping(let i, let id):
            return "Conversation \(i)'s current_node (\(id)) isn't in its own mapping - the export format may have changed."
        case .cycleDetected(let i):
            return "Conversation \(i)'s parent chain doesn't terminate - refusing to loop forever."
        }
    }
}

// MARK: - Raw export shape (OpenAI's documented conversations.json format)

struct ChatExportConversation: Decodable {
    let title: String?
    let mapping: [String: ChatExportNode]
    let currentNode: String?

    enum CodingKeys: String, CodingKey {
        case title, mapping
        case currentNode = "current_node"
    }
}

struct ChatExportNode: Decodable {
    let id: String
    let message: ChatExportMessage?
    let parent: String?
}

struct ChatExportMessage: Decodable {
    let author: ChatExportAuthor
    let createTime: Double?
    let content: ChatExportContent

    enum CodingKeys: String, CodingKey {
        case author, content
        case createTime = "create_time"
    }
}

struct ChatExportAuthor: Decodable {
    let role: String
}

struct ChatExportContent: Decodable {
    let contentType: String
    let parts: [ChatExportPart]?

    enum CodingKeys: String, CodingKey {
        case contentType = "content_type"
        case parts
    }
}

/// Real exports mix plain-text parts with multimodal parts (image
/// references, tool payloads) in the same `parts` array. Decoded
/// permissively - a non-string part is `.nonText`, counted as a rejection
/// rather than crashing the whole decode (memo §3.1: "drop ... non-text
/// parts, counting rejections the way the existing ingesters do").
enum ChatExportPart: Decodable {
    case text(String)
    case nonText

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) {
            self = .text(str)
        } else {
            self = .nonText
        }
    }
}

// MARK: - Parsed output (local-only; never leaves this pipeline unfiltered)

struct ChatHistoryTurn {
    let role: String
    let text: String
    let timestamp: Date?
}

/// A user turn plus its reply, carrying the user turn's real timestamp -
/// the unit the classifier (Step 2, not built tonight) will operate on.
struct ChatHistoryExchange {
    let conversationTitle: String?
    let userText: String
    let replyText: String
    let timestamp: Date?
}

struct ChatHistoryRunReport {
    var conversationsTotal = 0
    var conversationsParsed = 0
    var conversationsFailed = 0
    var nodesWalked = 0
    var droppedSystemOrTool = 0
    var droppedNonText = 0
    var droppedEmptyText = 0
    var exchangesProduced = 0
    var failures: [String] = []
}

enum ChatHistoryImportParser {
    /// Parses a raw `conversations.json` payload into exchanges plus a run
    /// report. Never throws on a single bad conversation - one malformed
    /// conversation is recorded in the report and skipped, not a reason to
    /// fail the whole import (real exports run into the thousands of
    /// conversations; one bad apple shouldn't lose the rest). Throws only
    /// when the *file itself* doesn't look like a conversations.json at all.
    static func parse(data: Data) throws -> ([ChatHistoryExchange], ChatHistoryRunReport) {
        let decoded: [ChatExportConversation]
        do {
            decoded = try JSONDecoder().decode([ChatExportConversation].self, from: data)
        } catch {
            throw ChatHistoryImportError.notAnArray
        }
        guard !decoded.isEmpty else { throw ChatHistoryImportError.emptyExport }

        var report = ChatHistoryRunReport()
        report.conversationsTotal = decoded.count
        var exchanges: [ChatHistoryExchange] = []

        for (index, conversation) in decoded.enumerated() {
            do {
                let turns = try reconstructThread(conversation, index: index, report: &report)
                let convExchanges = segmentIntoExchanges(turns, title: conversation.title)
                exchanges.append(contentsOf: convExchanges)
                report.exchangesProduced += convExchanges.count
                report.conversationsParsed += 1
            } catch {
                report.conversationsFailed += 1
                report.failures.append("conversation \(index): \(error.localizedDescription)")
            }
        }

        return (exchanges, report)
    }

    /// Walks `current_node` back to root via `parent` pointers, then
    /// reverses - the canonical thread, ignoring any abandoned branches
    /// (regenerated/edited replies fork the tree; only the path to
    /// `current_node` is what the user actually ended up with).
    private static func reconstructThread(
        _ conversation: ChatExportConversation,
        index: Int,
        report: inout ChatHistoryRunReport
    ) throws -> [ChatHistoryTurn] {
        guard let currentNode = conversation.currentNode else {
            throw ChatHistoryImportError.conversationMissingCurrentNode(index: index)
        }
        guard conversation.mapping[currentNode] != nil else {
            throw ChatHistoryImportError.currentNodeNotInMapping(index: index, nodeId: currentNode)
        }

        var chain: [ChatExportNode] = []
        var cursor: String? = currentNode
        var visited = Set<String>()
        while let nodeId = cursor {
            guard !visited.contains(nodeId) else {
                throw ChatHistoryImportError.cycleDetected(index: index)
            }
            visited.insert(nodeId)
            guard let node = conversation.mapping[nodeId] else { break }
            chain.append(node)
            cursor = node.parent
        }
        chain.reverse()
        report.nodesWalked += chain.count

        var turns: [ChatHistoryTurn] = []
        for node in chain {
            guard let message = node.message else { continue }
            guard message.author.role == "user" || message.author.role == "assistant" else {
                report.droppedSystemOrTool += 1
                continue
            }
            var textParts: [String] = []
            var sawNonText = false
            for part in message.content.parts ?? [] {
                switch part {
                case .text(let str): textParts.append(str)
                case .nonText: sawNonText = true
                }
            }
            if sawNonText { report.droppedNonText += 1 }
            let text = textParts.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else {
                report.droppedEmptyText += 1
                continue
            }
            let timestamp = message.createTime.map { Date(timeIntervalSince1970: $0) }
            turns.append(ChatHistoryTurn(role: message.author.role, text: text, timestamp: timestamp))
        }
        return turns
    }

    /// Pairs a user turn with the assistant reply that immediately follows
    /// it. Consecutive user turns with no intervening reply (rare, but real
    /// - edited-and-resent messages) each start their own exchange rather
    /// than being silently merged or dropped.
    private static func segmentIntoExchanges(_ turns: [ChatHistoryTurn], title: String?) -> [ChatHistoryExchange] {
        var exchanges: [ChatHistoryExchange] = []
        var i = 0
        while i < turns.count {
            guard turns[i].role == "user" else { i += 1; continue }
            let userTurn = turns[i]
            if i + 1 < turns.count, turns[i + 1].role == "assistant" {
                exchanges.append(ChatHistoryExchange(
                    conversationTitle: title,
                    userText: userTurn.text,
                    replyText: turns[i + 1].text,
                    timestamp: userTurn.timestamp
                ))
                i += 2
            } else {
                exchanges.append(ChatHistoryExchange(
                    conversationTitle: title,
                    userText: userTurn.text,
                    replyText: "",
                    timestamp: userTurn.timestamp
                ))
                i += 1
            }
        }
        return exchanges
    }
}
