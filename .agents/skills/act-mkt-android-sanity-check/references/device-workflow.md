# Device and build workflow

Sources checked on 2026-11-09:

- [Activities release runbook](https://agoda.atlassian.net/wiki/spaces/ACV/pages/1164148794/Activities+app+release+sign-off+run+book), snapshot `d1:2`.
- [Beta installation and experiment forcing](https://agoda.atlassian.net/wiki/spaces/APP/pages/173375645/How+to+install+and+test+on+Beta+app), version 40.
- [Activities CXP testing](https://agoda.atlassian.net/wiki/spaces/ACV/pages/2792425100/Testing+CXP+Features).
- [CXP emulator/device setup](https://agoda.atlassian.net/wiki/spaces/CXP/pages/1875607617/Testing+CXP+live-url+page+locally+on+native+emulator+device).
- [Prelive limitations](https://agoda.atlassian.net/wiki/spaces/PDW/pages/2828731000/Testing+App+iOS+Android+on+Pre-live+Force+Experiment+Origin+-+Current+Limitations).
- [ADB](https://developer.android.com/tools/adb) and [App Link verification](https://developer.android.com/training/app-links/verify-applinks).

These are operational references, not proof of current device behavior. Inspect live configuration and confirm each override on the actual screen.

## Select and start

Discover SDK from `ANDROID_HOME` / `ANDROID_SDK_ROOT` or the machine's configured SDK. On macOS the usual location is `~/Library/Android/sdk`.

```bash
"<SDK>/emulator/emulator" -list-avds
"<SDK>/emulator/emulator" -avd <AVD> -no-snapshot-save
"<SDK>/platform-tools/adb" devices -l
python3 <skill>/scripts/android_sanity.py --serial <SERIAL> preflight
```

Use an existing suitable AVD first. If a resumed snapshot produces stalled launches, null UI roots or capture timeouts, try one cold boot with `-no-snapshot-load -no-snapshot-save`, retaining app data. Preserve initial failures separately. Boot with bounded polling of `sys.boot_completed`; do not confuse an online ADB transport with a booted app environment. Record whether this run started the emulator. Close only run-owned processes when done.

On a real device, USB debugging and the user's RSA authorization are prerequisites. Explicitly bind every ADB command to its serial. Confirm the phone reaches internal prelive hosts; the laptop's VPN does not automatically give the phone access. Reuse a configured proxy/VPN route; record changes for restoration.

## Download and identify package

An MR is optional. Resolve the supplied target before downloading:

- MR: use authenticated `glab` or connected GitLab tools to read the supplied MR head, successful build job and artifact metadata.
- Branch: discover the repository's default branch if requested; otherwise use the specified branch, including main or master. Select a successful build on that branch and pin its commit and exact job ID. A latest-branch artifact URL can drift after selection.
- Release candidate: resolve the requested release tag, version or distribution build reference to its exact APK/package. Record stable release/distribution provenance, version/build and SHA-256; retain the source commit if available. No MR or fabricated Git SHA is required for a native RC.

For any web/CXP target, a compatible daily Android debug build can be the host, with separate pinned web revision identity. Prove that downloaded and installed artifacts match the requested target; never fall back to a sample MR or unrelated build.

A native merge-result or merge-train job can have a different SHA from the MR source head. Record both and prove the job's MR association and included feature revision; for this POC the changed production source/resource/Gradle file hashes were compared between source head and train revision. Do not silently substitute a later daily build for an expired MR package. Record an expired artifact's response and request authorization before regenerating it through CI; track the exact retried job and package provenance.

```bash
glab api --hostname gitlab.agodadev.io 'projects/<PROJECT>/jobs/<JOB>/artifacts' > <run>/downloads/build.zip
```

Check API exit status and ZIP integrity before using the file. List archive entries first. Extract only the selected APK into a fixed task-owned destination; avoid arbitrary archive path extraction. If it contains split APKs, install the matching split set, not one arbitrary split. An AAB is not directly installable; resolve a compatible APK/APKS package.

For Firebase distribution, follow the beta guide with the user's authorized account. Verify version/build and artifact provenance; SSO or group access may require user handoff. Do not request passwords or invent an access token. Do not trigger CI/deploy jobs merely to hide a missing artifact.

```bash
python3 <skill>/scripts/android_sanity.py apk-info <APK> --aapt <SDK>/build-tools/<VERSION>/aapt
adb -s <SERIAL> install -r <APK>
adb -s <SERIAL> shell dumpsys package <PACKAGE>
```

`apk-info` deliberately leaves `identity_verified=false`: the agent must match provenance and installed package/version before setting it true. Preserve the original package metadata. A signature mismatch or downgrade error is BLOCKED; do not uninstall or wipe app data. Install a compatible Konsole Debug package using its documented distribution source.

An older MR APK can be tested on a fresh task-owned AVD using an already-installed system image, preserving the existing app's newer data. Record its name, path, serial and process ownership. Verify the SDK tool's Java requirement and use an installed compatible JDK for that child command; avoid changing the user's global Java configuration. Complete any required account handoff before testing, and preserve user-controlled sign-in state.

Check app flavor and `apk-info.schemes` before deep-link tests. Production release candidate uses `agoda://`; beta uses `agoda4://`. Preserve runbook URLs as `canonical_url` and execute the selected flavor's URL in `url`; only the scheme changes. Verify actual APK registration and normal HTTPS App Link routing separately. A verified beta deep-link pass satisfies the beta matrix, while production RC remains untested. If another official APK is needed, verify its own provenance and installed identity, add it to `context.additional_apps`, and record each case's `app_package` and flavor. A first-run or sign-in gate is a prerequisite blocker; native foreground alone does not prove the landing.

## Konsole and CXP

Konsole may request Display over other apps; obtain authorization for that permission if not already covered, record its original mode and restore it after the run. Decline unrelated permissions that are not needed for the test.

Before changes, capture Konsole experiment/tools values, WebView overrides, app locale, app version, link state and proxy settings. Store the before-state and restoration checklist in the run folder. Do not invent an export API; screenshots and observed values are acceptable.

The beta guide documents: DevConsole Debug > Experiments > search experiment > choose A/B > Apply experiment & restart > reopen Agoda. Capture the API readback and selected local override separately. In the POC, the API button could still read `API(A)` while B was staged; readback changed after restart and consumption. Verify the effective consuming screen/request after restart, not only a staging label. Restore the original API selection rather than forcing A as cleanup, then refresh its consuming-layer readback.

For CXP, Activities guidance documents Konsole > Tools > `WebViewDevMode` > apply tools and restart; enter a CXP page and open its gear bubble. Configure the selected target's deployed host and branch. `MSPA_BRANCH=MR<id>` applies only to an MR deployment; use the actual branch/release mapping for other targets. The guide uses prelive host `sgp.agoda.com`; verify the current mapping rather than assuming it. Force web experiments only when feature scope requires them, then apply/reload. For a server/client devstack use its current deployed URL and routing mechanism.

Inspect bundle/asset manifest, debug revision metadata or a deployment artifact mapping to prove served web SHA equals the pinned target revision. Save that observation. If this proof is unavailable, do not assert the selected web build was tested.

For native request inspection, the POC Stetho tool exposed its app debugger socket only after an explicit cold process restart following apply. Record and restore the tool toggle and any run-owned ADB forward. Keep only relevant, sanitized request/response fields; do not attach authentication headers or unrelated account traffic.

Native Konsole force headers and WebView `explist` propagation can differ. Prelive references warn that live hosts may drop force headers and that experiments may need an active prelive run. Treat these as checks, not permission to alter global allocations. Origin forcing is separate and outside the default smoke scope.

## Operate and observe the UI

Launch the package using its discovered launcher activity with action `android.intent.action.MAIN` and category `android.intent.category.LAUNCHER`, matching an app-icon tap. A bare component intent can return without opening the expected home screen; verify the foreground package before assertions. For every action, inspect the current screenshot and UI hierarchy before choosing a resource ID, label or coordinate. Avoid stored coordinates and blind fixed waits. Use bounded state checks, with a recorded timeout failure.

```bash
adb -s <SERIAL> shell uiautomator dump /sdcard/sanity-<CASE>-attempt1.xml
# Continue only after a successful new dump, never after a null-root/error result.
adb -s <SERIAL> pull /sdcard/sanity-<CASE>-attempt1.xml <run>/evidence/<CASE>-ui.xml
adb -s <SERIAL> shell input tap <CURRENT_X> <CURRENT_Y>
```

For an inspectable debug WebView, use its available debugger/DOM to assert web content. A missing UI tree is not a successful test. Observe native/WebView transitions, visible results and selected entity values. Do not replace the journey with direct detail links.

Poll foreground and destination content with a bounded timeout after an external tap. Chrome can remain foreground briefly during routing. Record the final screen and assertions; native package identity alone cannot distinguish the intended destination from an access gate. If a fresh UI dump is killed, inspect memory and process diagnostics before retrying. For this POC, a cold boot with transient `-memory 4096` resolved a 2 GB emulator's memory pressure; this is an observed workaround, not a universal memory requirement.

Cold start: stop only the selected app, then open the link. Warm start: keep it running and open the next link. `force-stop` does not clear app data. Before locale changes, capture the app's language; use its language setting and restore it. Record app locale separately from the URL locale, since canonical runbook URLs include Thai paths.

Use an un-targeted browsable intent to diagnose OS resolution. For HTTPS sign-off, also tap the exact link from an external browser/message/link surface and record the destination package and screen:

```bash
adb -s <SERIAL> shell "am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '<CANONICAL_URL>'"
adb -s <SERIAL> shell pm get-app-links <PACKAGE>
```

ADB shell arguments must be quoted for both the host and device shell, especially URLs containing `&`. Avoid `eval`; pass argv arrays with explicit device-shell quoting when using Python. Do not force-approve domains to manufacture an App Link pass. A package-targeted diagnostic is labeled separately.

## Evidence and cleanup

Capture PNG before recovery. Run `record --seconds 30` as a tracked process, interact during its recording window, and wait for it to finish/pull the MP4. Do not detach an untracked recorder. The helper removes only its UUID-named remote video; local evidence remains.

Inspect UI dumps and request logs before attaching them: a WebView hierarchy can contain prefilled contact fields below the visible screenshot. Attach a whitelisted assertion extract when needed, and retain the original privately. Screenshots and recordings also need a visual check before sharing.

Restore changed settings in reverse order, including after failures. Reopen the relevant settings and capture proof. Remove only run-owned remote hierarchy files and stop run-owned recorders/proxies/emulator processes. Preserve the installed app and local report/media unless the user requested their removal. Never use broad process kills or data-clear commands.

### Restart-path evidence

In the MR42241 API34 POC, applying experiments with Stetho enabled sometimes crashed the consumer `:phoenix` restart process with a WebView data-directory conflict. Capture the dialog before recovery, keep the failed attempt, then cold force-stop/launch without clearing data. A later cold-launch success does not erase the original failure or prove the MR introduced it. Disable temporary inspection tools when capture is finished and verify the tool update.

For scoped feature checks, use the selected build's source to resolve exact dedicated section identifiers. In the historical MR42241 POC, ACTB-2885 Jira used `activities_awareness_banner` as an example while the native MR used `activities_3rd_banner`. A different example name alone is not a mismatch. Empty live content verifies only the empty-content fallback; eligible-card, claim, failure/retry and auto-apply cases still need controlled fixtures.

For the external-link matrix, keep one task-owned Chrome fixture tab and bring it back to the foreground between taps. Repeated VIEW launches can create a new fixture tab for every case; a Chrome ANR interrupted the POC after many tabs. Capture a browser failure separately from app assertions, recover only the selected browser/device without clearing data, and revalidate the fixture label before tapping.
