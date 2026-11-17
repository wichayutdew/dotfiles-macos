# Reference MRs

The skill applies the same rules to every repository. These MRs are the calibration set.

## UAT required, screen proof present

[trips-web 4519](https://gitlab.agodadev.io/full-stack/cart/trips-web/-/merge_requests/4519)

One row per customer case, with a screenshot and the trip data that produced it. Cases include one city, several cities, the overflow case, the feature turned off, and the analytics event.

## UAT required, screen proof missing

[trips-web 5669](https://gitlab.agodadev.io/full-stack/cart/trips-web/-/merge_requests/5669)

The trip map shows saved-flight airports. Verification lists automated test counts only. The draft is an unchecked **MR owner to re-check** list. Do not ask for more unit tests.

## UAT required, API proof present

[Yoda 1139](https://gitlab.agodadev.io/full-stack/cart/yoda/-/merge_requests/1139)

Each row has a Postman screenshot and the response a caller should receive: one city, several cities in one country, several countries, a translated response, and the experiment turned off.

## UAT required, API proof missing

[Yoda 1245](https://gitlab.agodadev.io/full-stack/cart/yoda/-/merge_requests/1245)

A caller can dismiss a rail and receive 200, 400, or 401. The test plan lists automated tests only. The draft is an unchecked **MR owner to re-check** list asking for a Postman screenshot or Grafana log of those three outcomes. The screen that hides the rail is a later story and does not remove the need for this proof.

## UAT not required

Stop after the reason. Do not draft a UAT comment.

| MR | Reason |
|---|---|
| [Yoda 1239](https://gitlab.agodadev.io/full-stack/cart/yoda/-/merge_requests/1239) | Experiment made permanent. Customers already had this behavior. Point at the original experiment MRs. |
| [Yoda 1244](https://gitlab.agodadev.io/full-stack/cart/yoda/-/merge_requests/1244) | Storage only. No caller can use the dismissal yet. |
| [activities-web 5825](https://gitlab.agodadev.io/full-stack/activities/activities-web/-/merge_requests/5825) | Dependency bump. The MR states there is no customer-visible change. |
| [activities-web 5935](https://gitlab.agodadev.io/full-stack/activities/activities-web/-/merge_requests/5935) | CI-only lint memory change. |
| [activities-web 5939](https://gitlab.agodadev.io/full-stack/activities/activities-web/-/merge_requests/5939) | CI test-gate change. No customer flow changes. |

## No acceptance criteria and no design

[ACTB-3068](https://agoda.atlassian.net/browse/ACTB-3068) and [agoda-com-spa-mobile 53157](https://gitlab.agodadev.io/full-stack/monoliths/agoda-com-spa-mobile/-/merge_requests/53157)

The ticket description is empty and the MR screenshot section is empty. Infer the customer scenarios from the code. Do not invent AC numbers. The draft is the unchecked **MR owner to re-check** list in [comment-tone.md](comment-tone.md). When a later review has both proven and missing scenarios, use the checked **QA UAT review** list plus the re-check list, as in the acceptance-criteria example in that file.
