import ActivityKit
import SwiftUI
import WidgetKit

private let teal = Color(red: 0.06, green: 0.71, blue: 0.76)
private let violet = Color(red: 0.55, green: 0.36, blue: 0.96)
private let night = Color(red: 0.03, green: 0.06, blue: 0.13)

@main
struct GatemateWidgetsBundle: WidgetBundle {
    var body: some Widget {
        FlightLiveActivity()
    }
}

struct FlightLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FlightActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(night)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Endpoint(code: context.attributes.fromCode, city: context.attributes.fromCity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Endpoint(code: context.attributes.toCode, city: context.attributes.toCity, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.flightNumber).font(.caption.bold()).foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        FlightProgress(state: context.state)
                        HStack {
                            Headline(attributes: context.attributes, state: context.state)
                            Spacer()
                            if let gate = context.state.gate {
                                Label("\(context.attributes.labelGate) \(gate)", systemImage: "door.left.hand.open").font(.caption.bold())
                            }
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "airplane").foregroundStyle(teal)
            } compactTrailing: {
                Countdown(state: context.state).font(.caption.monospacedDigit().bold()).foregroundStyle(teal).frame(maxWidth: 56)
            } minimal: {
                Image(systemName: "airplane").foregroundStyle(teal)
            }
            .keylineTint(teal)
        }
    }
}

private struct LockScreenView: View {
    let attributes: FlightActivityAttributes
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(attributes.flightNumber, systemImage: "airplane.circle.fill").font(.subheadline.bold()).foregroundStyle(teal)
                Spacer()
                Text(state.status).font(.caption.bold())
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background((state.delayed ? Color.orange : teal).opacity(0.25), in: Capsule())
                    .foregroundStyle(state.delayed ? Color.orange : teal)
            }
            HStack(alignment: .center) {
                Endpoint(code: attributes.fromCode, city: attributes.fromCity, alignment: .leading)
                Spacer()
                VStack(spacing: 2) {
                    Headline(attributes: attributes, state: state).font(.caption2).foregroundStyle(.white.opacity(0.7))
                    Countdown(state: state).font(.title2.monospacedDigit().bold()).foregroundStyle(.white)
                }
                Spacer()
                Endpoint(code: attributes.toCode, city: attributes.toCity, alignment: .trailing)
            }
            FlightProgress(state: state)
            HStack(spacing: 14) {
                if let gate = state.gate { Info(label: attributes.labelGate, value: gate) }
                if let terminal = state.terminal { Info(label: "T", value: terminal) }
                if let seat = state.seat { Info(label: attributes.labelSeat, value: seat) }
                Spacer()
                Info(label: attributes.labelBoarding, value: state.boarding.formatted(date: .omitted, time: .shortened))
            }
        }
        .padding(16)
        .foregroundStyle(.white)
    }
}

private struct Endpoint: View {
    let code: String
    let city: String
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 0) {
            Text(code).font(.title.bold()).foregroundStyle(.white)
            Text(city).font(.caption2).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
        }
    }
}

private struct Info: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.55))
            Text(value).font(.subheadline.bold())
        }
    }
}

private struct Headline: View {
    let attributes: FlightActivityAttributes
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        let now = Date()
        if now < state.departure {
            Text(attributes.labelDepartsIn)
        } else if now < state.arrival {
            Text(attributes.labelLandsIn)
        } else {
            Text(attributes.labelLanded)
        }
    }
}

private struct Countdown: View {
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        let now = Date()
        if now < state.departure {
            Text(timerInterval: now...state.departure, countsDown: true)
        } else if now < state.arrival {
            Text(timerInterval: now...state.arrival, countsDown: true)
        } else {
            Image(systemName: "checkmark.circle.fill")
        }
    }
}

private struct FlightProgress: View {
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        let now = Date()
        if now >= state.departure && now < state.arrival {
            ProgressView(timerInterval: state.departure...state.arrival, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                .tint(teal)
        } else {
            ProgressView(value: now >= state.arrival ? 1 : 0).tint(now >= state.arrival ? teal : violet)
        }
    }
}
