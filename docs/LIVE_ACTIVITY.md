# Live Activity: lock screen, Dynamic Island, Apple Watch

A few hours before a flight, Gatemate puts it on the iPhone lock screen and in the Dynamic Island: a countdown to
departure, then to landing, with gate, terminal, seat, boarding time and status. On Apple Watch (watchOS 11+) it
shows up in the Smart Stack by itself. The countdowns tick in iOS without waking the app; the app updates the
activity when the gate, seat or status changes and ends it 30 minutes after landing. There's also a
"Show on lock screen" button on a trip's Flights tab.

Already in the repo:

- `ios/App/App/LiveActivityPlugin.swift`: the Capacitor plugin (`LiveActivity`) and the bridge view controller that
  registers it. Already part of the App target.
- `ios/App/App/FlightActivityAttributes.swift`: what the activity shows. Already part of the App target.
- `ios/App/App/Info.plist`: `NSSupportsLiveActivities = YES`.
- `ios/App/GatemateWidgets/`: the widget extension's code (`FlightLiveActivity.swift` and its own copy of
  `FlightActivityAttributes.swift`; keep the two copies identical).
- `src/app/core/services/live-activity.service.ts`: starts, updates and ends it from the next flight.

## One-time setup in Xcode (about 2 minutes)

1. `npm run cap:sync`, then `npx cap open ios`.
2. **File → New → Target… → Widget Extension**. Product Name: `GatemateWidgets`. Tick **Include Live Activity**,
   untick Configuration App Intent. Finish, and **Activate** the scheme if asked.
3. In the new `GatemateWidgets` group, **delete** the Swift files Xcode generated (Move to Trash). Keep its
   `Info.plist` and `Assets.xcassets`.
4. Drag `ios/App/GatemateWidgets/FlightLiveActivity.swift` and `ios/App/GatemateWidgets/FlightActivityAttributes.swift`
   from Finder into that group. In the dialog, tick **only** the `GatemateWidgets` target.
5. Select the `GatemateWidgets` target → General → **Minimum Deployments: iOS 16.2**. Signing & Capabilities: same
   Team as the app.
6. Run the **App** scheme on an iPhone (Live Activities don't show in every simulator). Open a trip with a flight in
   the next 6 hours, or tap **Show on lock screen** on the Flights tab, then lock the phone.

If the activity doesn't appear: Settings → Gatemate → Live Activities must be on.
