import Foundation
import EventKit

/// Loads the next week from Apple Calendar into Field Desk events.
/// Falls back quietly when access is denied (caller can use sample week).
@MainActor
enum DeskCalendarLoader {
    static func loadUpcomingWeek() async -> [FieldDeskStore.CalendarEvent] {
        let store = EKEventStore()
        let ok: Bool
        if #available(iOS 17.0, *) {
            ok = (try? await store.requestFullAccessToEvents()) ?? false
        } else {
            ok = await withCheckedContinuation { cont in
                store.requestAccess(to: .event) { granted, _ in
                    cont.resume(returning: granted)
                }
            }
        }
        guard ok else { return [] }

        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        guard let end = cal.date(byAdding: .day, value: 7, to: start) else { return [] }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)
            .sorted { $0.startDate < $1.startDate }

        let dayFmt = DateFormatter()
        dayFmt.dateFormat = "EEE"

        return events.prefix(8).map { ev in
            FieldDeskStore.CalendarEvent(
                id: ev.eventIdentifier ?? UUID().uuidString,
                day: dayFmt.string(from: ev.startDate),
                title: ev.title ?? "Event"
            )
        }
    }
}
