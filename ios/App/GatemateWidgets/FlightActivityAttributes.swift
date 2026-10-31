import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct FlightActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var departure: Date
        public var arrival: Date
        public var boarding: Date
        public var gate: String?
        public var terminal: String?
        public var seat: String?
        public var status: String
        public var delayed: Bool
    }

    public var flightId: String
    public var flightNumber: String
    public var airline: String
    public var fromCode: String
    public var fromCity: String
    public var toCode: String
    public var toCity: String
    public var labelDepartsIn: String
    public var labelLandsIn: String
    public var labelBoarding: String
    public var labelGate: String
    public var labelSeat: String
    public var labelLanded: String
}
