import EventKit
import EventKitUI
import SwiftUI

/// "QCal invite" - schedules a study session on the student's own calendar
/// and hands off to Mail to actually notify the other person.
///
/// Real platform constraint, not a shortcut: EventKit deliberately does not
/// let third-party apps add attendees to a calendar event (Apple blocks this
/// to prevent spam - there is no public API for it). A true one-tap "send a
/// calendar invite to someone else" isn't possible from an app like this one.
/// The honest, working version is two steps: put the block on your own
/// calendar via the system Calendar composer, then draft an email to the
/// other person with the details, via whatever mail client they actually use.
@MainActor
enum QCalInvite {
    static func requestAccessAndBuildEvent(title: String, notes: String) async -> EKEvent? {
        let store = EKEventStore()
        let granted: Bool
        if #available(iOS 17.0, *) {
            granted = (try? await store.requestFullAccessToEvents()) ?? false
        } else {
            granted = await withCheckedContinuation { cont in
                store.requestAccess(to: .event) { ok, _ in cont.resume(returning: ok) }
            }
        }
        guard granted else { return nil }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.notes = notes
        event.calendar = store.defaultCalendarForNewEvents
        // Next half-hour boundary, 30 minutes long - a sensible default the
        // student can drag to whatever time actually works before saving.
        let now = Date()
        let cal = Calendar.current
        let minute = cal.component(.minute, from: now)
        let roundedUp = cal.date(byAdding: .minute, value: (minute < 30 ? 30 - minute : 60 - minute), to: now) ?? now
        event.startDate = roundedUp
        event.endDate = cal.date(byAdding: .minute, value: 30, to: roundedUp) ?? roundedUp.addingTimeInterval(1800)
        return event
    }

    /// `mailto:` handoff - works with whatever mail client is actually set
    /// up on the device, no MFMailComposeViewController account requirement.
    static func mailURL(to email: String, name: String, eventTitle: String, start: Date) -> URL? {
        guard !email.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        let subject = "Study session — \(eventTitle)"
        let body = "Hi \(name),\n\nProposing \(formatter.string(from: start)) for a study session on The Desk. Let me know if that works.\n"
        var comps = URLComponents()
        comps.scheme = "mailto"
        comps.path = email
        comps.queryItems = [
            URLQueryItem(name: "subject", value: subject),
            URLQueryItem(name: "body", value: body),
        ]
        return comps.url
    }
}

/// Thin SwiftUI wrapper around the system Calendar event editor.
struct EventEditView: UIViewControllerRepresentable {
    let event: EKEvent
    let eventStore: EKEventStore
    var onFinish: (EKEventEditViewAction) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let controller = EKEventEditViewController()
        controller.event = event
        controller.eventStore = eventStore
        controller.editViewDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: EKEventEditViewController, context: Context) {}

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let onFinish: (EKEventEditViewAction) -> Void
        init(onFinish: @escaping (EKEventEditViewAction) -> Void) { self.onFinish = onFinish }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
            onFinish(action)
        }
    }
}
