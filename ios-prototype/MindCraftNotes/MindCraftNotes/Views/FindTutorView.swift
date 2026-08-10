import SwiftUI
import MapKit

/// Real "Find a Tutor" - reuses Apple's own MapKit (no Google Maps SDK or API
/// key needed on-device, unlike the web version which needs
/// `VITE_GOOGLE_MAPS_API_KEY`) to plot the same real tutor directory
/// (`TutorDirectoryClient`, ported from `FindTutor.tsx`). Tapping a tutor
/// opens their real Calendly booking link in Safari - same booking mechanism
/// as web, just without the in-app Places Autocomplete search (a fast-follow,
/// not core to "can a student actually book a real tutor").
struct FindTutorView: View {
    @StateObject private var client = TutorDirectoryClient()
    @State private var selectedTutorId: String?
    @State private var cameraPosition: MapCameraPosition = .automatic
    @Environment(\.openURL) private var openURL

    var body: some View {
        // iPad-native layout audit (Phase 5 round 5): this was a fixed
        // 260pt map ALWAYS stacked above a full-width tutor list - on a
        // real iPad that's a thin letterbox map over a single stretched
        // column, wasting the wide canvas. iPad's actual own Maps app (and
        // most map+list pickers) put the two side by side once there's
        // room; this reads that intent off the runtime width instead of
        // hardcoding "iPad" - narrow presentations (iPhone, Slide Over,
        // portrait split view) keep the original stacked layout, which is
        // still correct there.
        GeometryReader { geo in
            let wide = geo.size.width >= 700
            Group {
                if wide {
                    HStack(spacing: 0) {
                        mapView
                            .frame(width: geo.size.width * 0.42)
                        tutorList
                    }
                } else {
                    VStack(spacing: 0) {
                        mapView
                            .frame(height: 260)
                        tutorList
                    }
                }
            }
        }
        .task { await client.load() }
        .navigationTitle("Find a Tutor")
    }

    private var mapView: some View {
        Map(position: $cameraPosition, selection: $selectedTutorId) {
            ForEach(client.tutors) { tutor in
                Marker(tutor.displayName, coordinate: tutor.coordinate)
                    .tag(tutor.id)
            }
        }
    }

    private var tutorList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(client.tutors) { tutor in
                    TutorCard(tutor: tutor, isSelected: tutor.id == selectedTutorId) {
                        selectedTutorId = tutor.id
                        withAnimation {
                            cameraPosition = .region(
                                MKCoordinateRegion(center: tutor.coordinate, span: MKCoordinateSpan(latitudeDelta: 2, longitudeDelta: 2))
                            )
                        }
                    } onBook: {
                        if let url = URL(string: tutor.calendlyUrl) {
                            openURL(url)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(TutorColor.cream)
    }
}

// Phase 5 (2026-08-06): verified against the live `FindTutor.module.css`
// directly - its `.page` rule (line 1) defines `--cream:#fbf4e7`,
// `--forest:#064d36`, `--green:#4eb543`, `--ink:#343434`, the SAME token
// block `Book.module.css` shares (both cited together in the plan doc as a
// cross-check). Unlike Dashboard/Login/Map/Notes/Chapter, this is genuinely
// a light cream "storybook" page, NOT the dark chalkboard - confirmed from
// the live CSS itself, not assumed from adjacent screens (the exact mistake
// this phase's own cautionary example warns against making in the other
// direction). File-scoped, same reasoning as DeskColor/MapColor/etc.
private enum TutorColor {
    static let cream = Color(tutorHex: "fbf4e7")
    static let forest = Color(tutorHex: "064d36")
    static let green = Color(tutorHex: "4eb543")
    static let ink = Color(tutorHex: "343434")
    static let inkMuted = Color(tutorHex: "343434").opacity(0.64)
}

private extension Color {
    init(tutorHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

private struct TutorCard: View {
    let tutor: Tutor
    let isSelected: Bool
    let onSelect: () -> Void
    let onBook: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(tutor.displayName)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(TutorColor.forest)
                    Spacer()
                    Text(tutor.regionLabel)
                        .font(.system(size: 12, design: .rounded))
                        .foregroundColor(TutorColor.inkMuted)
                }
                Text(tutor.bio)
                    .font(.system(size: 13, design: .rounded))
                    .foregroundColor(TutorColor.ink.opacity(0.8))
                    .lineLimit(3)
                if !tutor.subjects.isEmpty {
                    Text(tutor.subjects.joined(separator: " · "))
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(TutorColor.green)
                }
                Button("Book a session", action: onBook)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .buttonStyle(.borderedProminent)
                    .tint(TutorColor.green)
                    .controlSize(.small)
                    .padding(.top, 4)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(tutorHex: "fffdf7"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(isSelected ? TutorColor.green : Color.clear, lineWidth: 2)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
