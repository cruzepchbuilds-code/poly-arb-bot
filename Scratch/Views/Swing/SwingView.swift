import SwiftUI
import PhotosUI

struct SwingView: View {
    @EnvironmentObject var appVM: AppViewModel
    @EnvironmentObject var swingVM: SwingViewModel
    @State private var showPhotoPicker = false
    @State private var selectedItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            ZStack {
                ScratchColors.background.ignoresSafeArea()
                ScrollView(showsIndicators: false) {
                    VStack(spacing: ScratchLayout.sectionSpacing) {
                        // Upload card
                        uploadCard
                        // Club & angle selection
                        if swingVM.recordingState == .idle {
                            setupSection
                        }
                        // Recent analyses
                        if !appVM.swingAnalyses.isEmpty {
                            recentAnalyses
                        } else if swingVM.recordingState == .idle {
                            emptyState
                        }
                        Spacer(minLength: 100)
                    }
                    .padding(.horizontal, ScratchLayout.screenPadding)
                    .padding(.top, 8)
                }

                // State overlays
                if swingVM.recordingState == .uploading || swingVM.recordingState == .analyzing {
                    LoadingOverlay(message: swingVM.recordingState == .uploading ? "Uploading video..." : "Analyzing swing...")
                }
            }
            .navigationTitle("Swing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    uploadCountBadge
                }
            }
            .sheet(isPresented: $swingVM.showPaywall) { PaywallView() }
            .sheet(isPresented: $swingVM.showAnalysisResult) {
                if let analysis = swingVM.currentAnalysis {
                    SwingAnalysisView(analysis: analysis)
                }
            }
            .photosPicker(isPresented: $showPhotoPicker, selection: $selectedItem, matching: .videos)
            .onChange(of: selectedItem) { item in
                Task {
                    guard let item,
                          let data = try? await item.loadTransferable(type: Data.self),
                          let url = saveVideoTemp(data: data)
                    else { return }
                    swingVM.selectVideo(url: url, appVM: appVM)
                }
            }
        }
    }

    // MARK: - Upload Count
    private var uploadCountBadge: some View {
        Group {
            if appVM.userProfile?.subscriptionTier == .pro {
                HStack(spacing: 4) {
                    Image(systemName: "infinity").font(.system(size: 10))
                    Text("Unlimited").font(ScratchFont.caption(11))
                }
                .foregroundColor(ScratchColors.gold)
            } else {
                Text("\(appVM.usageStats.swingUploadsRemaining) upload left")
                    .font(ScratchFont.caption(11))
                    .foregroundColor(ScratchColors.textTertiary)
            }
        }
    }

    // MARK: - Upload Card
    private var uploadCard: some View {
        VStack(spacing: 16) {
            if swingVM.recordingState == .reviewing {
                // Video ready to submit
                VStack(spacing: 16) {
                    Image(systemName: "video.fill")
                        .font(.system(size: 48))
                        .foregroundColor(ScratchColors.green)
                    Text("Video ready")
                        .font(ScratchFont.headline())
                        .foregroundColor(ScratchColors.textPrimary)
                    Text("Club: \(swingVM.selectedClub.rawValue) · \(swingVM.selectedAngle.rawValue)")
                        .font(ScratchFont.body())
                        .foregroundColor(ScratchColors.textSecondary)
                    HStack(spacing: 12) {
                        Button("Cancel") { swingVM.reset() }
                            .font(ScratchFont.subheadline())
                            .foregroundColor(ScratchColors.textSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(ScratchColors.surface3)
                            .cornerRadius(ScratchLayout.cornerRadius)
                        PrimaryButton(title: "Analyze", icon: "sparkles", style: .green) {
                            swingVM.analyzeSwing(appVM: appVM)
                        }
                    }
                }
                .padding(ScratchLayout.cardPadding + 8)
            } else {
                // Upload prompt
                Button {
                    if appVM.canUploadSwing {
                        showPhotoPicker = true
                    } else {
                        swingVM.showPaywall = true
                    }
                } label: {
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(ScratchColors.green.opacity(0.15))
                                .frame(width: 72, height: 72)
                            Image(systemName: "video.badge.plus")
                                .font(.system(size: 32, weight: .medium))
                                .foregroundColor(ScratchColors.green)
                        }
                        VStack(spacing: 6) {
                            Text("Upload a Swing Video")
                                .font(ScratchFont.headline())
                                .foregroundColor(ScratchColors.textPrimary)
                            Text("Face-on or down-the-line · Any club")
                                .font(ScratchFont.body())
                                .foregroundColor(ScratchColors.textSecondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(28)
                    .background(
                        RoundedRectangle(cornerRadius: ScratchLayout.cardRadius + 4)
                            .strokeBorder(
                                ScratchColors.green.opacity(0.4),
                                style: StrokeStyle(lineWidth: 1.5, dash: [6])
                            )
                    )
                }
            }
        }
    }

    // MARK: - Setup Section
    private var setupSection: some View {
        VStack(spacing: 20) {
            // Club selector
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Club")
                HStack(spacing: 8) {
                    ForEach([Club.driver, .iron, .wedge, .putter]) { club in
                        Button {
                            swingVM.selectedClub = club
                        } label: {
                            VStack(spacing: 4) {
                                Text(club.emoji).font(.system(size: 20))
                                Text(club.shortName)
                                    .font(ScratchFont.caption(11))
                                    .foregroundColor(ScratchColors.textPrimary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(swingVM.selectedClub == club ? ScratchColors.green.opacity(0.2) : ScratchColors.surface2)
                            .cornerRadius(ScratchLayout.cornerRadius)
                            .overlay(
                                RoundedRectangle(cornerRadius: ScratchLayout.cornerRadius)
                                    .stroke(swingVM.selectedClub == club ? ScratchColors.green : Color.clear, lineWidth: 1.5)
                            )
                        }
                    }
                }
            }

            // Angle selector
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Camera Angle")
                HStack(spacing: 10) {
                    ForEach(SwingAngle.allCases) { angle in
                        Button {
                            swingVM.selectedAngle = angle
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(angle.rawValue)
                                        .font(ScratchFont.subheadline())
                                        .foregroundColor(ScratchColors.textPrimary)
                                    Spacer()
                                    if swingVM.selectedAngle == angle {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(ScratchColors.green)
                                            .font(.system(size: 16))
                                    }
                                }
                                Text(angle.tip)
                                    .font(ScratchFont.caption(11))
                                    .foregroundColor(ScratchColors.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(ScratchLayout.cardPadding)
                            .background(swingVM.selectedAngle == angle ? ScratchColors.green.opacity(0.1) : ScratchColors.surface2)
                            .cornerRadius(ScratchLayout.cardRadius)
                            .overlay(
                                RoundedRectangle(cornerRadius: ScratchLayout.cardRadius)
                                    .stroke(swingVM.selectedAngle == angle ? ScratchColors.green : Color.clear, lineWidth: 1.5)
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: - Recent Analyses
    private var recentAnalyses: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Recent Analyses")
            ForEach(appVM.swingAnalyses.prefix(5)) { analysis in
                SwingHistoryRow(analysis: analysis)
            }
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            icon: "video.circle",
            title: "No swings yet",
            message: "Upload your first swing above. We'll find the one change that moves the needle most.",
            actionTitle: "Upload Swing"
        ) {
            showPhotoPicker = true
        }
        .padding(.top, 20)
    }

    private func saveVideoTemp(data: Data) -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mov")
        try? data.write(to: url)
        return url
    }
}

// MARK: - Swing History Row
private struct SwingHistoryRow: View {
    let analysis: SwingAnalysis

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(analysis.club.emoji) \(analysis.club.rawValue) · \(analysis.angle.rawValue)")
                    .font(ScratchFont.subheadline())
                    .foregroundColor(ScratchColors.textPrimary)
                Spacer()
                ConfidenceBadge(confidence: analysis.confidence)
            }
            if analysis.status == .complete {
                Text(analysis.mainIssue)
                    .font(ScratchFont.body(14))
                    .foregroundColor(ScratchColors.textSecondary)
                    .lineLimit(2)
            } else {
                Text(analysis.status.rawValue)
                    .font(ScratchFont.caption())
                    .foregroundColor(ScratchColors.textTertiary)
            }
            Text(analysis.date.shortDisplay)
                .font(ScratchFont.caption(11))
                .foregroundColor(ScratchColors.textTertiary)
        }
        .padding(ScratchLayout.cardPadding)
        .background(ScratchColors.surface)
        .cornerRadius(ScratchLayout.cardRadius)
    }
}
