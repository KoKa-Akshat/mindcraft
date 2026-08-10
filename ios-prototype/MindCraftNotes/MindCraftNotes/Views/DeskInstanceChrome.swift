import SwiftUI

/// Shared chrome for every Desk instance (Field Desk, ACT Field Book,
/// test-instance, custom). From Field Desk, Home opens the ACT dash stage
/// on the desk; Minimize on the stage returns to the desk cards.
struct DeskHomeButton: View {
    var action: () -> Void
    var accessibilityId: String = "deskInstanceHome"
    var accessibilityLabelText: String = "Home"

    var body: some View {
        Button(action: action) {
            Image(systemName: "house.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white.opacity(0.95))
                .padding(10)
                .background(Circle().fill(Color.black.opacity(0.5)))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(accessibilityId)
        .accessibilityLabel(accessibilityLabelText)
    }
}

/// Mic control for writing boxes - taps toggle speech → text via
/// `SpeechCaptureController`. Falls back to a toast-style disabled state
/// when recognition isn't available.
struct VoiceCaptureButton: View {
    @ObservedObject var capture: SpeechCaptureController
    var tint: Color = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
    var onBeforeToggle: (() -> Void)? = nil

    init(
        capture: SpeechCaptureController,
        tint: Color = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255),
        onBeforeToggle: (() -> Void)? = nil
    ) {
        self.capture = capture
        self.tint = tint
        self.onBeforeToggle = onBeforeToggle
    }

    var body: some View {
        Button {
            onBeforeToggle?()
            capture.toggle()
        } label: {
            Image(systemName: capture.isListening ? "waveform.circle.fill" : "mic.circle.fill")
                .font(.system(size: 26, weight: .semibold))
                .foregroundColor(capture.isListening ? tint : tint.opacity(0.85))
                .opacity(capture.isListening ? 1 : 0.9)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskVoiceCapture")
        .accessibilityLabel(capture.isListening ? "Stop voice" : "Speak instead of typing")
    }
}
