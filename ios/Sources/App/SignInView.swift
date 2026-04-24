import SwiftUI
import GoogleSignIn

struct SignInView: View {
    @StateObject private var auth = AuthManager.shared
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.10, green: 0.12, blue: 0.20), Color(red: 0.15, green: 0.18, blue: 0.32)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 48) {
                Spacer()

                VStack(spacing: 16) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 64, weight: .light))
                        .foregroundColor(.white)

                    Text("Finance")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    Text("투자 포트폴리오 모니터")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.6))
                }

                Spacer()

                VStack(spacing: 16) {
                    if let error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red.opacity(0.8))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    Button {
                        Task { await signIn() }
                    } label: {
                        HStack(spacing: 12) {
                            if isLoading {
                                ProgressView().tint(.black)
                            } else {
                                Image(systemName: "g.circle.fill")
                                    .font(.title3)
                                Text("Google로 로그인")
                                    .font(.headline)
                            }
                        }
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(isLoading)
                    .padding(.horizontal, 32)
                }
                .padding(.bottom, 48)
            }
        }
    }

    private func signIn() async {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = scene.windows.first?.rootViewController else { return }
        isLoading = true
        error = nil
        do {
            try await auth.signIn(presenting: root)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
