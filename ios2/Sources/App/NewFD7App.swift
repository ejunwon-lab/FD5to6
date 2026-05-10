import SwiftUI
import GoogleSignIn

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     handleEventsForBackgroundURLSession identifier: String,
                     completionHandler: @escaping () -> Void) {
        BackgroundNetworkSession.shared.backgroundCompletionHandler = completionHandler
    }
}

@main
struct NewFD7App: App {
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
