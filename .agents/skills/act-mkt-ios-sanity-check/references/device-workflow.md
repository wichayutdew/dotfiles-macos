# iOS device workflow

## Xcode and targets

Use Apple's installed CLI help as the exact command contract. Check:

```bash
xcode-select -p
DEVELOPER_DIR='<Xcode.app>/Contents/Developer' xcodebuild -version
DEVELOPER_DIR='<Xcode.app>/Contents/Developer' xcrun simctl list devices available --json
DEVELOPER_DIR='<Xcode.app>/Contents/Developer' xcrun devicectl list devices --json-output <private-devices.json>
```

A CommandLineTools selection does not provide simctl/devicectl. Set `DEVELOPER_DIR` for this process; do not change the system selection. The helper uses an explicit directory, an existing environment value, or a single installed full Xcode when the global selection has no simctl.

Record an explicit device UDID/identifier. A real iPhone must be paired, unlocked when needed, trusted, and have Developer Mode enabled and confirmed after reboot. If its iOS version needs newer Xcode/device support, report the exact compatibility blocker.

For an existing simulator:

```bash
xcrun simctl boot <UDID>
xcrun simctl bootstatus <UDID> -b
```

Inspect an already booted simulator instead of booting it again. Preserve original simulator power state and app settings in cleanup. Never erase a user's simulator.

## Find the correct package

Read the MR and exact pipeline/job metadata through authenticated GitLab tooling. Native simulator jobs often contain a zipped `.app`; physical-device distributions use a signed `.ipa` or device `.app`. Inspect the specific job, artifact path and expiration. An expired older build is not current feature proof.

Download the exact artifact with authenticated tooling, for example `glab api projects/<PROJECT_ID>/jobs/<JOB_ID>/artifacts > <private-artifact.zip>`. Verify that the download succeeded before treating the file as an archive. Record the stable job URL and artifact checksum, not a signed URL or token. Enumerate archive paths and reject absolute paths, `..` traversal and escaping symlinks before extraction into a new private directory.

Inspect `Info.plist`, executable Mach-O build platform (`xcrun vtool -show-build`) and supported architectures. The helper's `bundle-info` checks simulator versus device platform and lists registered Agoda URL schemes. Check minimum iOS version and, for a device bundle, signing/provisioning/entitlements using Apple's tools. Inspect signing locally; do not expose provisioned device identities or certificate details in a report. Verify that device installation actually succeeds; a plist alone cannot prove provisioning compatibility.

Record MR head and built commit separately. A merge-ref job builds a merged result; retain pipeline evidence for its relationship to the source head. After installation, compare installed bundle/version/build and visible About information to the inspected artifact.

```bash
xcrun simctl install <UDID> <simulator.app>
xcrun simctl launch <UDID> <BUNDLE_ID>
xcrun devicectl device install app --device <DEVICE_ID> <signed-device.app>
xcrun devicectl device process launch --device <DEVICE_ID> <BUNDLE_ID>
```

Use `ditto` or an available approved extractor only after validating archive paths. Extracting a device `.ipa` does not convert it into a simulator app. Do not distribute to Firebase/TestFlight just to obtain a test package. A package-only CI build may be run when the requested test authorizes building, but record its job and outcome.

## In-app experiment controller

The [beta app testing guide](https://agoda.atlassian.net/wiki/spaces/APP/pages/173375645/How+to+install+and+test+on+Beta+app) describes iOS: shake the internal app, find Developer tools > Client Experiments, change the intended experiment and finish with Done. On Simulator, inspect the Device menu's Shake action or its current shortcut; on a real iPhone, use its in-app developer entry point or supported shake gesture.

Capture the initial setting and effective variant. Distinguish default/unforced, forced A and forced B according to the actual controller. Search by the exact experiment and verify its internal flag mapping from MR/code when needed. A toggle screenshot before Done proves only the requested override. After Done and any reload, reopen the controller or read consuming-layer diagnostics to prove the effective variant; failed allocation requests can leave the effective value different from the requested value. An off switch may mean A or no allocation: establish its contract before claiming A.

If the controller offers an A scope, verify from its current source that it filters the effective selected variant to A and excludes unallocated values. After applying Done, reopen, search the exact experiment and select that scope. A matching row then distinguishes effective A from an ambiguous off switch. Capture the selected scope and row together.

Restore both value and override presence. In controllers where switching off writes an explicit A override, it does not restore an initially unforced state. Remove only this run's override through a supported control. Use Remove All Overrides only after verifying no unrelated overrides exist; otherwise preserve those settings and report the cleanup blocker. Capture the restored state after applying it.

Use the [CXP testing guide](https://agoda.atlassian.net/wiki/spaces/ACV/pages/2792425100/Testing+CXP+Features) for embedded web content: enable WebView dev mode in the in-app developer tools, set the intended host/MR branch and forced experiment list, then reload. Prove the requested web revision and effective WebView variant; native overrides may not propagate to web/API layers.

## UI control and links

Prefer available native/device automation or CUA for real UI interaction. Re-read the current accessibility tree or screenshot before choosing controls. Use current observed labels and state-based waits; do not hardcode another device's pixel positions. Keep native and WebView transitions in the same observed journey.

When several Simulator windows exist, verify the window title matches the recorded target before each journey and select it through Window when necessary. If native scrolling does not move the list, raise that window through its exposed accessibility action, refresh the tree, and use an exposed Scroll Down/Scroll Up action; verify the resulting viewport. A dispatched gesture alone proves no navigation.

Diagnostic URL dispatch:

```bash
xcrun simctl openurl <UDID> 'agoda://activities'
xcrun devicectl device process launch --device <DEVICE_ID> --payload-url 'agoda://activities' <BUNDLE_ID>
```

For Universal Links, use a tap from Notes or another external app. A task-owned loopback page in simulator Safari can provide cross-domain anchor taps without a synced Notes account. Record `entry_method=external_tap` only after observing that tap and its destination. Direct package payload dispatch and Safari address-bar navigation do not test external association. Do not create notes in a personal synced account without scope; prefer an isolated simulator/local test surface.

Select the app channel before dispatch: production RC uses `agoda`, beta uses `agoda4`. Verify that scheme in the installed bundle's `CFBundleURLTypes`; do not infer channel from simulator versus device. The examples above use production RC; use `agoda4://activities` for beta. Preserve the original runbook URL in `runbook_url` and record the channel-resolved tested `url`, changing only the custom scheme. HTTPS URLs stay unchanged. Wrong-channel attempts remain diagnostic history with their media, not selected-channel coverage or beta feature failures. Record app language and effective page language separately when a URL explicitly includes `/th-th/`.

[Apple TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links) documents external-app testing and why address-bar entry does not launch the app. Inspect associated domains and Apple's association diagnostics when normal routing differs from targeted routing; preserve the original failure.

Check the domain's `/apple-app-site-association` and `/.well-known/apple-app-site-association` files, then the exact installed app's code signature (`codesign -d --entitlements :- <app>` and `codesign -d --verbose=4 <app>`). Server paths, the matching app identifier and the app's `applinks:<domain>` entitlement are separate prerequisites. A simulator artifact may be linker-signed without the app's team/application identifier or association entitlements. Record that build limitation and any unavailable OS approval/cache evidence; a valid server file alone does not prove device association. Never re-sign a package or reset association state as an undisclosed recovery shortcut.

## Evidence

Simulator screenshots use `simctl io <UDID> screenshot`. Simulator recordings use `recordVideo --codec=h264`; send SIGINT and wait for finalization. The helper bounds recordings to 1–60 seconds, stops only its own recorder and refuses existing filenames. Run a recording in an exec session while performing the UI journey, then collect its completion.

Real-device capture is capability-dependent. Check installed Xcode command help rather than inventing a devicectl capture command. On Xcode versions without device capture, use Xcode's Devices/device display screenshot action, QuickTime's selected iPhone recording, or an already configured and device-verified mobile UI driver. Record the capture source and selected device. Do not install a new privileged driver, change signing or grant screen-recording access silently. If control/capture is unavailable, continue independent simulator work and report affected device cases BLOCKED.

Inspect screenshots and play recordings. Blank/protected/unrelated captures do not satisfy useful failure evidence. Logs cannot substitute for a failed test's screenshot/video. Restore settings and close only the recording/Simulator session started for this run when appropriate.
