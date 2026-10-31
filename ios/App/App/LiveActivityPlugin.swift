import ActivityKit
import Capacitor
import Foundation

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAll", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities need iOS 16.2 or later")
            return
        }
        guard let id = call.getString("flightId"),
              let departure = Self.date(call.getString("departure")),
              let arrival = Self.date(call.getString("arrival")) else {
            call.reject("flightId, departure and arrival are required")
            return
        }
        let boarding = Self.date(call.getString("boarding")) ?? departure.addingTimeInterval(-40 * 60)
        let state = FlightActivityAttributes.ContentState(
            departure: departure, arrival: arrival, boarding: boarding,
            gate: call.getString("gate"), terminal: call.getString("terminal"), seat: call.getString("seat"),
            status: call.getString("status") ?? "", delayed: call.getBool("delayed") ?? false)
        let content = ActivityContent(state: state, staleDate: arrival.addingTimeInterval(30 * 60))

        if let running = Activity<FlightActivityAttributes>.activities.first(where: { $0.attributes.flightId == id }) {
            Task {
                await running.update(content)
                call.resolve(["id": running.id, "updated": true])
            }
            return
        }
        let labels = call.getObject("labels") ?? [:]
        let attributes = FlightActivityAttributes(
            flightId: id,
            flightNumber: call.getString("flightNumber") ?? "",
            airline: call.getString("airline") ?? "",
            fromCode: call.getString("fromCode") ?? "",
            fromCity: call.getString("fromCity") ?? "",
            toCode: call.getString("toCode") ?? "",
            toCity: call.getString("toCity") ?? "",
            labelDepartsIn: labels["departsIn"] as? String ?? "Departs in",
            labelLandsIn: labels["landsIn"] as? String ?? "Lands in",
            labelBoarding: labels["boarding"] as? String ?? "Boarding",
            labelGate: labels["gate"] as? String ?? "Gate",
            labelSeat: labels["seat"] as? String ?? "Seat",
            labelLanded: labels["landed"] as? String ?? "Landed")
        do {
            for other in Activity<FlightActivityAttributes>.activities {
                Task { await other.end(nil, dismissalPolicy: .immediate) }
            }
            let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
            call.resolve(["id": activity.id, "updated": false])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let id = call.getString("flightId")
        Task {
            for a in Activity<FlightActivityAttributes>.activities where id == nil || a.attributes.flightId == id {
                await a.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    @objc func endAll(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for a in Activity<FlightActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            call.resolve()
        }
    }

    private static func date(_ s: String?) -> Date? {
        guard let s else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}

class GatemateBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
