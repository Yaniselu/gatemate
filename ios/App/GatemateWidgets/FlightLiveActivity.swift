import ActivityKit
import SwiftUI
import WidgetKit

private let teal = Color(red: 0.13, green: 0.78, blue: 0.83)
private let tealDeep = Color(red: 0.04, green: 0.53, blue: 0.59)
private let violet = Color(red: 0.55, green: 0.42, blue: 0.97)
private let amber = Color(red: 1.0, green: 0.69, blue: 0.13)
private let night = Color(red: 0.03, green: 0.06, blue: 0.13)
private let navy = Color(red: 0.07, green: 0.13, blue: 0.27)

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
                .activitySystemActionForegroundColor(teal)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    IslandEndpoint(code: context.attributes.fromCode, city: context.attributes.fromCity, alignment: .leading)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    IslandEndpoint(code: context.attributes.toCode, city: context.attributes.toCity, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 3) {
                        Text(context.attributes.flightNumber)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        StatusPill(state: context.state, compact: true)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 10) {
                        RouteLine(state: context.state)
                        HStack(alignment: .bottom, spacing: 8) {
                            VStack(alignment: .leading, spacing: 0) {
                                Headline(attributes: context.attributes, state: context.state)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.6))
                                Countdown(state: context.state)
                                    .font(.system(size: 26, weight: .bold, design: .rounded).monospacedDigit())
                                    .foregroundStyle(.white)
                            }
                            Spacer(minLength: 4)
                            if let gate = context.state.gate {
                                Chip(label: context.attributes.labelGate, value: gate, accent: true).frame(maxWidth: 74)
                            }
                            if let seat = context.state.seat {
                                Chip(label: context.attributes.labelSeat, value: seat).frame(maxWidth: 64)
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 4)
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: "airplane")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(teal)
                    if let gate = context.state.gate {
                        Text(gate)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }
            } compactTrailing: {
                Countdown(state: context.state)
                    .font(.system(size: 13, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(context.state.delayed ? amber : teal)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 58)
            } minimal: {
                Image(systemName: "airplane")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(context.state.delayed ? amber : teal)
            }
            .keylineTint(teal)
        }
    }
}

private struct LockScreenView: View {
    let attributes: FlightActivityAttributes
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(LinearGradient(colors: [teal, tealDeep], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: "airplane")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .rotationEffect(.degrees(-45))
                }
                .frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 0) {
                    Text(attributes.flightNumber)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                    if !attributes.airline.isEmpty {
                        Text(attributes.airline)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 6)
                StatusPill(state: state, compact: false)
            }

            HStack(alignment: .center, spacing: 10) {
                Endpoint(code: attributes.fromCode, city: attributes.fromCity, alignment: .leading)
                VStack(spacing: 4) {
                    Headline(attributes: attributes, state: state)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.6))
                    Countdown(state: state)
                        .font(.system(size: 24, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    RouteLine(state: state)
                }
                .frame(maxWidth: .infinity)
                Endpoint(code: attributes.toCode, city: attributes.toCity, alignment: .trailing)
            }

            HStack(spacing: 6) {
                if let gate = state.gate {
                    Chip(label: attributes.labelGate, value: gate, accent: true)
                }
                if let terminal = state.terminal {
                    Chip(label: "T", value: terminal)
                }
                if let seat = state.seat {
                    Chip(label: attributes.labelSeat, value: seat)
                }
                Chip(label: attributes.labelBoarding, value: state.boarding.formatted(date: .omitted, time: .shortened))
            }
        }
        .padding(16)
        .foregroundStyle(.white)
        .background(
            ZStack {
                LinearGradient(colors: [navy, night], startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [teal.opacity(0.32), .clear], center: .topTrailing, startRadius: 0, endRadius: 220)
                RadialGradient(colors: [violet.opacity(0.2), .clear], center: .bottomLeading, startRadius: 0, endRadius: 200)
            }
        )
    }
}

private struct Endpoint: View {
    let code: String
    let city: String
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 0) {
            Text(code)
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text(city)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.65))
                .lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
    }
}

private struct IslandEndpoint: View {
    let code: String
    let city: String
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 0) {
            Text(code)
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text(city)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))
                .lineLimit(1)
        }
    }
}

private struct Chip: View {
    let label: String
    let value: String
    var accent = false

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased())
                .font(.system(size: 8.5, weight: .bold))
                .foregroundStyle(.white.opacity(accent ? 0.85 : 0.55))
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(accent
                      ? AnyShapeStyle(LinearGradient(colors: [teal, tealDeep], startPoint: .topLeading, endPoint: .bottomTrailing))
                      : AnyShapeStyle(Color.white.opacity(0.09)))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.white.opacity(accent ? 0.25 : 0.08), lineWidth: 0.5)
        )
    }
}

private struct StatusPill: View {
    let state: FlightActivityAttributes.ContentState
    let compact: Bool

    var body: some View {
        let tone = state.delayed ? amber : teal
        HStack(spacing: 4) {
            Circle().fill(tone).frame(width: 6, height: 6)
            Text(state.status)
                .font(.system(size: compact ? 10 : 11, weight: .bold))
                .lineLimit(1)
        }
        .padding(.horizontal, compact ? 6 : 8)
        .padding(.vertical, compact ? 2 : 4)
        .background(Capsule().fill(tone.opacity(0.18)))
        .overlay(Capsule().stroke(tone.opacity(0.45), lineWidth: 0.5))
        .foregroundStyle(tone)
    }
}

private struct Headline: View {
    let attributes: FlightActivityAttributes
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        let now = Date()
        if now < state.departure {
            Text(attributes.labelDepartsIn.uppercased())
        } else if now < state.arrival {
            Text(attributes.labelLandsIn.uppercased())
        } else {
            Text(attributes.labelLanded.uppercased())
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

private struct RouteLine: View {
    let state: FlightActivityAttributes.ContentState

    var body: some View {
        let now = Date()
        let landed = now >= state.arrival
        HStack(spacing: 6) {
            Image(systemName: "airplane.departure")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(teal)
            Group {
                if now >= state.departure && !landed {
                    ProgressView(timerInterval: state.departure...state.arrival, countsDown: false) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                } else {
                    ProgressView(value: landed ? 1 : 0)
                }
            }
            .progressViewStyle(.linear)
            .tint(teal)
            Image(systemName: "airplane.arrival")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(landed ? teal : Color.white.opacity(0.45))
        }
    }
}
