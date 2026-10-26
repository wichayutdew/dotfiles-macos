# Activity Search Repository

## Directory Structure

```
common/
└── src/
    └── main/
        └── scala/
            └── com/
                └── agoda/
                    └── activity/
                        └── common/
                            └── experiments/
                                └── ActiveExperiments.scala
```

## Instructions

- Ask user for Experiment ID if not clear (e.g., ACT-XXXX, ACTB-XXXX, ACTD-XXXX, ACTSO-XXXX, AFT-XXXX, ABE-XXXX) using AskUserQuestion.
- Determine the experiment category based on the ticket prefix:
  - `ACT-*` = Activities Search
  - `ACTB-*` = Activities Marketing Tech
  - `ACTD-*` = Activities Detail
  - `ACTSO-*` = Activities Supply Optimization
  - `AFT-*` = Activities Booking
  - `ABE-*` = Activities Supply Connectivity
- Generate a meaningful experiment name in PascalCase based on the JIRA ticket description and confirm with user using AskUserQuestion.
- Add the experiment definition in `common/src/main/scala/com/agoda/activity/common/experiments/ActiveExperiments.scala` under the appropriate section.
- Add the experiment to the relevant experiment collections in `ActiveExperimentCollections` object:
  - `searchExperiments` - for Search and Cross-sell Search facades
  - `availabilityExperiments` - for Availability facade
  - `calendarExperiments` - for Calendar facade
  - `detailsExperiments` - for Details facade
  - `prepareBookingExperiments` - for PrepareBooking facade
  - `pricingRouteExperiments` - for PricingRoute facade
  - `reviewExperiments` - for Review facade
  - `crossSellSearchExperiments` - for Cross-sell Search facade
  - `crossSellAvailabilityExperiments` - for Cross-sell Availability facade

### Important Notes

- **Naming Convention**: Use PascalCase for experiment names (e.g., `AirportTransferGksRedirect`, not `airport_transfer_gks_redirect`).
- **Placement**: Add experiments in alphabetical or logical order within their category section.
- **Collections**: Add experiments to ALL relevant facade collections. Review the facade name in the collection to determine if your experiment applies.
- **Cross-sell Caution**: Note that cross-sell and standard search share underlying methods. Any changes to `searchExperiments` may impact both flows. See comments in the file.
- **Testing**: After adding an experiment, verify it compiles by running `sbt compile` in the repository root.

## Example

- User asks to add experiment ACT-6152 for "Airport Transfer GKS Redirect".
- Experiment ID is `ACT-6152` (Activities Search category).
- Experiment name decided: `AirportTransferGksRedirect`.

**Step 1:** Add experiment definition in the "Activities Search" section of ActiveExperiments.scala:
```scala
val AirportTransferGksRedirect: Experiment = Experiment("ACT-6152")
```

**Step 2:** Add to `searchExperiments` collection since it's related to search functionality:
```scala
val searchExperiments: Seq[Experiment] = Seq(
  ActiveExperiments.BmgSupplierChannelManagerExperiment,
  ActiveExperiments.ReferencedActivitiesReviewScores,
  ActiveExperiments.ActivitySubCategories,
  ActiveExperiments.AirportTransferGksRedirect, // <- Add here
  ActiveExperiments.GksSemanticSearch,
  // ... rest of experiments
)
```
