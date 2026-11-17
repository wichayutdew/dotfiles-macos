# Android beta smoke report example

Executed on 9 November 2026 for [client-android MR !42241](https://gitlab.agodadev.io/full-stack/mobile/android/client-android/-/merge_requests/42241). This is a real emulator POC, not fixture-generated passing results.

**Latest: 34/34 PASS. Overall: FAIL.** Five initial rendered-page failures remain in the report with screenshots even though their reruns passed. The report completeness checks pass.

[Download the report, manifest, assertions and screenshots](https://gitlab.agodadev.io/-/project/91769/uploads/0a21579211135a5cf150aa152bb04275/android-beta-smoke-report-compact.zip). Recordings are attached separately below. The compact archive includes every failure image, both booking-form success images and settings-restoration proof; other successful captures are represented by recorded assertions and original image hashes. Raw account, booking and network diagnostics are excluded.

## Run identity

| Field | Value |
|---|---|
| App flavor | Beta; expected and APK-registered `agoda4://` |
| Package / version / build | `com.agoda.mobile.consumer.debug` / `14.38.0-SNAPSHOT` / `687692` |
| Build source | [CI retry job 516390135](https://gitlab.agodadev.io/full-stack/mobile/android/client-android/-/jobs/516390135); APK checksum and installed identity in archive |
| Revision mapping | MR merge-train build; all 32 MR-changed production files match source head. Both revisions are recorded in the manifest |
| Device | Isolated Android 14 / API 34 / arm64 emulator |
| Locales and launch states | English and Thai; cold and warm |

## Coverage and scope

| Coverage | Latest result |
|---|---|
| HTTPS Home, Search, Detail and SEO links × 2 locales × cold/warm | 16 PASS |
| Beta `agoda4://` Home, Search, Detail and SEO links × same matrix | 16 PASS |
| Native Home → Activities tile → Activities Home → search → detail → offer/date → booking form | 2 PASS |

Production RC uses `agoda://`; beta uses `agoda4://`. Original runbook URLs are preserved as `canonical_url`, with the executed flavor-specific URL in `url`. HTTPS URLs are unchanged and tapped from an external Chrome fixture with normal Android resolution; no app-targeted intent or forced domain approval was used for those test URLs. Earlier production-template skips were superseded after the user clarified beta scheme handling.

Feature/A-B/coupon and Proxyman Map Remote checks were deferred by the user. This smoke run does not sign off the MR feature, production RC or physical-device journeys. URL currency requests displayed the account VND currency; precedence was not signed off.

## Latest cases

| Case | Locale / launch | Latest |
|---|---|---|
| `HOME-UL-en-cold` | en / cold | PASS |
| `HOME-DL-en-cold` | en / cold | PASS |
| `SEARCH-UL-en-cold` | en / cold | PASS |
| `SEARCH-DL-en-cold` | en / cold | PASS |
| `DETAIL-UL-en-cold` | en / cold | PASS |
| `DETAIL-DL-en-cold` | en / cold | PASS |
| `SEO-UL-en-cold` | en / cold | PASS |
| `SEO-DL-en-cold` | en / cold | PASS |
| `HOME-UL-en-warm` | en / warm | PASS |
| `HOME-DL-en-warm` | en / warm | PASS |
| `SEARCH-UL-en-warm` | en / warm | PASS |
| `SEARCH-DL-en-warm` | en / warm | PASS |
| `DETAIL-UL-en-warm` | en / warm | PASS |
| `DETAIL-DL-en-warm` | en / warm | PASS |
| `SEO-UL-en-warm` | en / warm | PASS |
| `SEO-DL-en-warm` | en / warm | PASS |
| `FUNNEL-en` | en / journey | PASS |
| `HOME-UL-th-cold` | th / cold | PASS |
| `HOME-DL-th-cold` | th / cold | PASS |
| `SEARCH-UL-th-cold` | th / cold | PASS |
| `SEARCH-DL-th-cold` | th / cold | PASS |
| `DETAIL-UL-th-cold` | th / cold | PASS |
| `DETAIL-DL-th-cold` | th / cold | PASS |
| `SEO-UL-th-cold` | th / cold | PASS |
| `SEO-DL-th-cold` | th / cold | PASS |
| `HOME-UL-th-warm` | th / warm | PASS |
| `HOME-DL-th-warm` | th / warm | PASS |
| `SEARCH-UL-th-warm` | th / warm | PASS |
| `SEARCH-DL-th-warm` | th / warm | PASS |
| `DETAIL-UL-th-warm` | th / warm | PASS |
| `DETAIL-DL-th-warm` | th / warm | PASS |
| `SEO-UL-th-warm` | th / warm | PASS |
| `SEO-DL-th-warm` | th / warm | PASS |
| `FUNNEL-th` | th / journey | PASS |

## Initial failures and reruns

Each failed attempt remains in the detailed report. These observations do not prove the MR introduced the failure.

### HOME-UL-en-cold

External Chrome tap normally resolved to MR app ActivitiesWebActivity, but the page stayed blank beyond 60 seconds on repeated observation. Reproduced after Stetho OFF. Route resolution succeeded; rendered Home assertion failed. No causal attribution to MR changes.

Latest rerun: **PASS**.

![HOME-UL-en-cold initial failure](https://gitlab.agodadev.io/-/project/91769/uploads/6f719e3a1122221cd24e8a9ee4cae196/home-ul-en-cold-stalled.png)

### SEO-UL-en-cold

Native Activities detail shell opened but Easykart title/content did not render; Loading persisted through five observations. Cause not attributed to MR.

Latest rerun: **PASS**.

![SEO-UL-en-cold initial failure](https://gitlab.agodadev.io/-/project/91769/uploads/1fbf2c4a2d5de1ef7b9085f70622895f/seo-ul-en-cold-38c99277.png)

### SEARCH-UL-en-warm

Native ActivitiesWebActivity opened but screenshot remained blank after bounded load observation. Cause not attributed to MR.

Latest rerun: **PASS**.

![SEARCH-UL-en-warm initial failure](https://gitlab.agodadev.io/-/project/91769/uploads/9793d32d7ce7803449bea2b101bc8e00/search-ul-en-warm-557a2aa4.png)

### DETAIL-UL-en-warm

External route resolved to native ActivitiesWebActivity but remained on Agoda splash after bounded load observation. Cause not attributed to MR.

Latest rerun: **PASS**.

![DETAIL-UL-en-warm initial failure](https://gitlab.agodadev.io/-/project/91769/uploads/6d02078573b925ab16b664763ebca814/detail-ul-en-warm-f675ceff.png)

### HOME-UL-th-cold

Normal HTTPS tap opened ActivitiesWebActivity, but final screenshot was blank at the end of the 34.5s observation protocol. Thai Home rendered-page assertion failed; cause unassigned.

Latest rerun: **PASS**.

![HOME-UL-th-cold initial failure](https://gitlab.agodadev.io/-/project/91769/uploads/9f2712c06428215069d4f58cff80346b/home-ul-th-cold-8dc39a83.png)

## Booking-form evidence

No booking was submitted. English: Saigon Skydeck admission, 10 November 2026, one adult, VND 204,650. Thai: corresponding admission, same date/count, VND 200,624. Prices were live at each execution; price equality between locales was not asserted.

![English booking form](https://gitlab.agodadev.io/-/project/91769/uploads/783e960b48f9162156c051c8a2b9694e/mr-funnel-en-booking.png)

[English booking-form recording](https://gitlab.agodadev.io/-/project/91769/uploads/45ea76becdc89b3986832e2d6630e89c/mr-funnel-en-booking.mp4)

![Thai booking form](https://gitlab.agodadev.io/-/project/91769/uploads/12421dfa63b48e16a7402b74bc2405ea/mr-funnel-th-booking.png)

[Thai booking-form recording](https://gitlab.agodadev.io/-/project/91769/uploads/dc2f0bb80a39142a3b9ead8a1a85222c/mr-funnel-th-booking.mp4)

## Restoration and limitations

English restored, all eight Konsole tools off, original experiment API selections restored, overlay permission returned to default, temporary ADB forward/reverse removed, and owned server/bridge/emulator stopped. App data, login, APK and isolated AVD were preserved. The child experiment read API(A) before forcing and cached API(B) at final inspection; API selection restoration is verified, but the final consuming assignment is not claimed.

Chrome also showed an ANR on the fixture page before a link tap. The browser was recovered without clearing data and the existing owned tab was reused; that interrupted observation is separate from Agoda page assertions.

The example is a historical record of this build against live services, not a current release sign-off.
