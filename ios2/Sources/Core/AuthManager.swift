import Foundation
import GoogleSignIn

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isSignedIn = false
    @Published var userEmail = ""

    private let scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/script.projects",
        "https://www.googleapis.com/auth/script.external_request",
        "https://www.googleapis.com/auth/script.storage",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]

    private init() {
        restoreSession()
    }

    func restoreSession() {
        GIDSignIn.sharedInstance.restorePreviousSignIn { [weak self] user, error in
            guard let self else { return }
            if let user, error == nil {
                Task { @MainActor in
                    self.isSignedIn = true
                    self.userEmail = user.profile?.email ?? ""
                }
            }
        }
    }

    func signIn(presenting: UIViewController) async throws {
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: presenting,
            hint: nil,
            additionalScopes: scopes
        )
        isSignedIn = true
        userEmail = result.user.profile?.email ?? ""
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        isSignedIn = false
        userEmail = ""
        CacheService.shared.clear()
    }

    func accessToken() async throws -> String {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            throw AuthError.notSignedIn
        }
        try await user.refreshTokensIfNeeded()
        guard let token = user.accessToken.tokenString as String? else {
            throw AuthError.tokenUnavailable
        }
        return token
    }
}

enum AuthError: LocalizedError {
    case notSignedIn
    case tokenUnavailable

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "로그인이 필요합니다."
        case .tokenUnavailable: return "인증 토큰을 가져올 수 없습니다."
        }
    }
}
