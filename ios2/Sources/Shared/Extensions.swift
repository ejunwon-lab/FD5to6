import SwiftUI

var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

func aFont(_ iPhone: Font, _ iPad: Font) -> Font {
    isPad ? iPad : iPhone
}

extension Color {
    static let profit   = Color(red: 0.85, green: 0.10, blue: 0.10)
    static let loss     = Color(red: 0.05, green: 0.35, blue: 0.85)
    static let cardBg   = Color(.systemBackground)
    static let pageBg   = Color(.systemGroupedBackground)
    static let accent   = Color(red: 0.25, green: 0.35, blue: 0.90)
}

extension String {
    var asChangePct: String {
        let isNeg = hasPrefix("(") || hasPrefix("-")
        let digits = filter { $0.isNumber || $0 == "." }
        guard let val = Double(digits), val != 0 else { return "+0.00%" }
        return String(format: "%+.2f%%", isNeg ? -val : val)
    }
}

extension Double {
    var krwFormatted: String {
        Int(self).formatted()
    }

    var krwFullFormatted: String {
        Int(self).formatted()
    }

    var krwCompact: String {
        let n = Int(self)
        let abs = Swift.abs(n)
        if abs >= 100_000_000 {
            let ok = String(format: "%.1f", Double(abs) / 100_000_000)
            return "\(n < 0 ? "-" : "")\(ok)억"
        } else if abs >= 10_000 {
            return "\(n < 0 ? "-" : "")\(abs / 10_000)만"
        }
        return krwFormatted
    }

    var krwCompactSigned: String {
        let n = Int(self)
        let sign = n >= 0 ? "+" : "-"
        let abs = Swift.abs(n)
        if abs >= 100_000_000 {
            let ok = String(format: "%.1f", Double(abs) / 100_000_000)
            return "\(sign)\(ok)억"
        } else if abs >= 10_000 {
            return "\(sign)\(abs / 10_000)만"
        }
        return krwFormatted
    }

    var pctFormatted: String {
        String(format: "%+.2f%%", self)
    }

    var profitColor: Color {
        self >= 0 ? .profit : .loss
    }
}
