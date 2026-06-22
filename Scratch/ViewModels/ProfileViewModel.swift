import SwiftUI

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var showPaywall: Bool = false
    @Published var showDeleteConfirm: Bool = false
    @Published var showEditProfile: Bool = false
    @Published var isSaving: Bool = false

    func deleteAccount(appVM: AppViewModel) {
        appVM.resetApp()
    }

    func saveProfile(_ profile: UserProfile, appVM: AppViewModel) {
        isSaving = true
        appVM.userProfile = profile
        StorageService.shared.saveUserProfile(profile)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.isSaving = false
            self?.showEditProfile = false
        }
    }
}
