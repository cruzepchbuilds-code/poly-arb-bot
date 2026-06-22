import SwiftUI
import AVFoundation

@MainActor
final class SwingViewModel: ObservableObject {
    enum RecordingState {
        case idle, recording, reviewing, uploading, analyzing, complete, failed
    }

    @Published var recordingState: RecordingState = .idle
    @Published var selectedClub: Club = .driver
    @Published var selectedAngle: SwingAngle = .faceOn
    @Published var videoURL: URL?
    @Published var currentAnalysis: SwingAnalysis?
    @Published var showAnalysisResult: Bool = false
    @Published var showPaywall: Bool = false
    @Published var errorMessage: String?
    @Published var uploadProgress: Double = 0

    private let aiService: any AIServiceProtocol = MockAIService()

    // MARK: - Video Selection (UIKit bridge)
    func selectVideo(url: URL, appVM: AppViewModel) {
        guard appVM.canUploadSwing else {
            showPaywall = true
            return
        }
        videoURL = url
        recordingState = .reviewing
    }

    // MARK: - Submit for Analysis
    func analyzeSwing(appVM: AppViewModel) {
        recordingState = .uploading
        uploadProgress = 0

        var pendingAnalysis = SwingAnalysis(club: selectedClub, angle: selectedAngle)
        pendingAnalysis.status = .uploading
        currentAnalysis = pendingAnalysis
        appVM.addSwingAnalysis(pendingAnalysis)
        appVM.recordSwingUpload()

        Task {
            // Simulate upload progress
            for p in stride(from: 0.0, through: 1.0, by: 0.1) {
                uploadProgress = p
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            recordingState = .analyzing

            do {
                var result = try await aiService.analyzeSwing(
                    club: selectedClub,
                    angle: selectedAngle,
                    notes: nil
                )
                result.id = pendingAnalysis.id
                result.date = pendingAnalysis.date
                currentAnalysis = result
                appVM.updateSwingAnalysis(result)
                recordingState = .complete
                showAnalysisResult = true
            } catch {
                var failed = pendingAnalysis
                failed.status = .failed
                currentAnalysis = failed
                appVM.updateSwingAnalysis(failed)
                recordingState = .failed
                errorMessage = "Analysis failed. Please try again."
            }
        }
    }

    func reset() {
        recordingState = .idle
        videoURL = nil
        currentAnalysis = nil
        errorMessage = nil
        uploadProgress = 0
    }

    // MARK: - Camera Permission
    var hasCameraPermission: Bool {
        AVCaptureDevice.authorizationStatus(for: .video) == .authorized
    }

    func requestCameraPermission() async -> Bool {
        await AVCaptureDevice.requestAccess(for: .video)
    }
}
