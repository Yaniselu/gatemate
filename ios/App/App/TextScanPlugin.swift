import Capacitor
import Foundation
import UIKit
import Vision

@objc(TextScanPlugin)
public class TextScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TextScanPlugin"
    public let jsName = "TextScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise),
    ]

    @objc func recognize(_ call: CAPPluginCall) {
        guard let raw = call.getString("image"),
              let data = Data(base64Encoded: raw.components(separatedBy: ",").last ?? "", options: .ignoreUnknownCharacters),
              let image = UIImage(data: data),
              let cg = image.cgImage else {
            call.reject("No readable image")
            return
        }
        let request = VNRecognizeTextRequest { request, error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            let found = (request.results as? [VNRecognizedTextObservation]) ?? []
            call.resolve(["lines": Self.lines(found)])
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        let orientation = Self.orientation(image.imageOrientation)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:]).perform([request])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private static func lines(_ found: [VNRecognizedTextObservation]) -> [String] {
        let items = found.compactMap { o -> (CGRect, String)? in
            guard let text = o.topCandidates(1).first?.string else { return nil }
            return (o.boundingBox, text)
        }.sorted { $0.0.midY > $1.0.midY }
        var rows: [[(CGRect, String)]] = []
        for item in items {
            if let last = rows.last?.first, abs(last.0.midY - item.0.midY) < max(last.0.height, item.0.height) * 0.5 {
                rows[rows.count - 1].append(item)
            } else {
                rows.append([item])
            }
        }
        return rows.map { row in row.sorted { $0.0.minX < $1.0.minX }.map { $0.1 }.joined(separator: "") }
    }

    private static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch o {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}
