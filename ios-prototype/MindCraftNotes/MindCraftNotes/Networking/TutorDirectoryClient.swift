import Foundation
import FirebaseFirestore
import CoreLocation

/// One tutor, real or the public demo roster - ported field-for-field from
/// `FindTutor.tsx`'s `Tutor` interface and its two hardcoded `DEMO_TUTORS`
/// entries (real people, real Calendly links, real approximate locations -
/// not fabricated).
struct Tutor: Identifiable {
    let id: String
    let displayName: String
    let bio: String
    let subjects: [String]
    let calendlyUrl: String
    let coordinate: CLLocationCoordinate2D
    let regionLabel: String
    let hasRealLocation: Bool
    /// Real contact email, kept for Book's "send to a tutor for review"
    /// (Assignment F) - empty for the hardcoded demo roster below (no
    /// verified real address on file for them, so callers fall back to
    /// `calendlyUrl` instead of guessing one), non-empty for a real
    /// Firestore tutor doc that has `calendlyEmail`/`email` set.
    let email: String
}

private let studioLocation = CLLocationCoordinate2D(latitude: 44.9379, longitude: -93.1706)
private let myrtleBeach = CLLocationCoordinate2D(latitude: 33.6891, longitude: -78.8867)
private let uncChapelHill = CLLocationCoordinate2D(latitude: 35.9049, longitude: -79.0469)
private let defaultBio = "Patient ACT, algebra, precalc, calculus, and stats help for students who need the first step to finally make sense."

/// Same public demo roster as `FindTutor.tsx`'s `DEMO_TUTORS` - real people
/// (the founders), real Calendly link, real approximate public locations.
private let demoTutors: [Tutor] = [
    Tutor(
        id: "akshat-koirala",
        displayName: "Akshat Koirala",
        bio: defaultBio,
        subjects: ["ACT Math", "AP Calculus", "Pre-Calc", "Statistics"],
        calendlyUrl: "https://calendly.com/joinmindcraft/30min",
        coordinate: studioLocation,
        regionLabel: "Macalester · St Paul, MN",
        hasRealLocation: true,
        email: ""
    ),
    Tutor(
        id: "blake-kell",
        displayName: "Blake Kell",
        bio: "Macalester student building MindCraft. Data science and math. Currently in Myrtle Beach. Calm focus for students who need less noise.",
        subjects: ["ACT Math", "Algebra", "Statistics"],
        calendlyUrl: "https://calendly.com/joinmindcraft/30min",
        coordinate: myrtleBeach,
        regionLabel: "Myrtle Beach, SC",
        hasRealLocation: true,
        email: ""
    ),
    Tutor(
        id: "abhigya-koirala",
        displayName: "Abhigya Koirala",
        bio: "Incoming applied mathematics PhD student at UNC Chapel Hill. Clear routes through hard ideas, without watering them down.",
        subjects: ["Algebra", "Pre-Calc", "Calculus", "Proofs", "ACT Math"],
        calendlyUrl: "https://calendly.com/joinmindcraft/30min",
        coordinate: uncChapelHill,
        regionLabel: "UNC Chapel Hill, NC",
        hasRealLocation: true,
        email: ""
    ),
]

/// One-shot real tutor directory fetch, mirroring `FindTutor.tsx`'s
/// `getDocs(query(collection(db, 'users'), where('role', '==', 'tutor')))`
/// effect exactly: same collection/field, same `location`/`locationAddress`
/// field names, same studio-address fallback when a tutor hasn't set a real
/// location yet, and the SAME id+normalized-name dedup this session's web
/// pass added to fix a real duplicate-listing bug (a signed-in tutor's real
/// Firestore doc and the hardcoded demo entry for the same person both
/// rendering). Ported here rather than re-discovering that bug natively.
@MainActor
final class TutorDirectoryClient: ObservableObject {
    @Published private(set) var tutors: [Tutor] = demoTutors
    @Published private(set) var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }

        let db = Firestore.firestore()
        guard let snapshot = try? await db.collection("users").whereField("role", isEqualTo: "tutor").getDocuments(),
              !snapshot.documents.isEmpty else {
            return
        }

        let remoteTutors: [Tutor] = snapshot.documents.map { doc in
            let data = doc.data()
            let email = (data["calendlyEmail"] as? String) ?? (data["email"] as? String) ?? ""
            let slug = email.split(separator: "@").first.map {
                String($0).lowercased().filter { $0.isLetter || $0.isNumber }
            } ?? ""
            let calendlyUrl = (data["calendlyUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 }
                ?? (slug.isEmpty ? "" : "https://calendly.com/\(slug)")

            let locationDict = data["location"] as? [String: Any]
            let lat = locationDict?["lat"] as? Double
            let lng = locationDict?["lng"] as? Double
            let hasRealLocation = lat != nil && lng != nil
            let coordinate = hasRealLocation
                ? CLLocationCoordinate2D(latitude: lat!, longitude: lng!)
                : studioLocation

            let regionLabel = (data["locationAddress"] as? String)
                ?? (data["regionLabel"] as? String)
                ?? (coordinate.longitude < -115 ? "California" : "Minnesota")

            return Tutor(
                id: doc.documentID,
                displayName: (data["displayName"] as? String) ?? "Tutor",
                bio: (data["bio"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? defaultBio,
                subjects: data["subjects"] as? [String] ?? [],
                calendlyUrl: calendlyUrl,
                coordinate: coordinate,
                regionLabel: regionLabel,
                hasRealLocation: hasRealLocation,
                // Same value already parsed above to build calendlyUrl's
                // slug - kept instead of discarded (Assignment F) so "send
                // to a tutor" has a real address to send to.
                email: email
            )
        }

        let demoIds = Set(demoTutors.map(\.id))
        let demoNames = Set(demoTutors.map { $0.displayName.trimmingCharacters(in: .whitespaces).lowercased() })
        let filteredRemote = remoteTutors.filter { t in
            !demoIds.contains(t.id) && !demoNames.contains(t.displayName.trimmingCharacters(in: .whitespaces).lowercased())
        }
        tutors = demoTutors + filteredRemote
    }
}
