import SwiftUI
import GoogleSignIn

class AppDelegate: NSObject, UIApplicationDelegate {
    /// 백그라운드 URLSession 작업이 완료되면 iOS가 앱을 깨우며 이 메서드를 호출함.
    /// completionHandler를 호출해야 iOS가 스냅샷을 업데이트하고 앱을 재슬립 처리함.
    func application(_ application: UIApplication,
                     handleEventsForBackgroundURLSession identifier: String,
                     completionHandler: @escaping () -> Void) {
        BackgroundNetworkSession.shared.backgroundCompletionHandler = completionHandler
    }
}

@main
struct FD5to6FinanceApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isSignedIn {
                    MainTabView()
                } else {
                    SignInView()
                }
            }
            .onOpenURL { url in
                GIDSignIn.sharedInstance.handle(url)
            }
        }
    }
}
