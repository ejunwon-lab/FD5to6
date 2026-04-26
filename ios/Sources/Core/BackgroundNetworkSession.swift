import Foundation

/// Background URLSession wrapper so GAS update requests survive screen-off / app suspension.
/// The OS networking daemon owns the socket; the app is woken briefly when data arrives.
final class BackgroundNetworkSession: NSObject {
    static let shared = BackgroundNetworkSession()

    /// Set by AppDelegate when iOS wakes the app to deliver background session events.
    var backgroundCompletionHandler: (() -> Void)?

    private var continuations: [Int: CheckedContinuation<Data, Error>] = [:]
    private var buffers: [Int: Data] = [:]
    private var tempFiles: [Int: URL] = [:]
    private let lock = NSLock()

    private(set) lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: "com.jun.fd5to6finance.gas-update")
        config.sessionSendsLaunchEvents = true
        config.isDiscretionary = false
        config.timeoutIntervalForRequest = 300
        config.timeoutIntervalForResource = 300
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private override init() { super.init() }

    /// POST request using a background upload task (background sessions require file-based body).
    func post(request: URLRequest, body: Data) async throws -> Data {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + ".json")
        try body.write(to: tmp)

        return try await withCheckedThrowingContinuation { cont in
            let task = session.uploadTask(with: request, fromFile: tmp)
            lock.lock()
            continuations[task.taskIdentifier] = cont
            buffers[task.taskIdentifier] = Data()
            tempFiles[task.taskIdentifier] = tmp
            lock.unlock()
            task.resume()
        }
    }
}

extension BackgroundNetworkSession: URLSessionDataDelegate {
    func urlSession(_ session: URLSession,
                    dataTask: URLSessionDataTask,
                    didReceive data: Data) {
        lock.lock()
        buffers[dataTask.taskIdentifier]?.append(data)
        lock.unlock()
    }

    func urlSession(_ session: URLSession,
                    task: URLSessionTask,
                    didCompleteWithError error: Error?) {
        lock.lock()
        let cont = continuations.removeValue(forKey: task.taskIdentifier)
        let data = buffers.removeValue(forKey: task.taskIdentifier)
        let tmp  = tempFiles.removeValue(forKey: task.taskIdentifier)
        lock.unlock()

        try? tmp.map { try FileManager.default.removeItem(at: $0) }

        if let error {
            cont?.resume(throwing: error)
        } else if let http = task.response as? HTTPURLResponse, http.statusCode != 200 {
            cont?.resume(throwing: APIError.httpError(http.statusCode))
        } else {
            cont?.resume(returning: data ?? Data())
        }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async { [weak self] in
            self?.backgroundCompletionHandler?()
            self?.backgroundCompletionHandler = nil
        }
    }
}
