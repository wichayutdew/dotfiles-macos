# Activities Web Repository


## Directory Structure

```
  src/
  ├── Agoda.Cronos.Activities.Web/
  │   ├── Constants/
  │   │   └── ExpId.cs
  │   └── Behaviors/
  │       └── BehaviorExperiments.cs
  └── Agoda.Cronos.Activities.ClientSide/
      └── src/
          ├── core/
          │   └── constant/
          │       └── FeatureName.ts
          └── mock/
              └── behavior/
                  └── behavior-agoda.ts
```

## Instructions

- Ask user about feature this experiment will fence.
- Generate few feature names and confirm with user to which they want to use using AskUserQuestion.
- Add the experiment id in `src/Agoda.Cronos.Activities.Web/Constants/ExpId.cs`.
- Add a new Behavior object in `src/Agoda.Cronos.Activities.Web/Behaviors/BehaviorExperiments.cs` file using the feature name that user confirmed.
- Add the new behavior object to `BehaviorModelMapping.ExperimentToBehaviorMapping` Dictionary.
- Add the feature name to `src/Agoda.Cronos.Activities.ClientSide/src/core/constant/FeatureName.ts`.
- Add the feature name to mock file `src/Agoda.Cronos.Activities.ClientSide/src/mock/behavior/behavior-agoda.ts`, `mockBehaviorAgoda.featureExperiments.featureBehavior` as enabled.


## Examples

- For example user asks to add experiment for ACT-6156-AT experiment in activities web, then agent follows below steps.
- For example, experiment id is ACT-6156-AT and feature name decided by user is `AppHomeAirportTransferLandingToATGks`.
- Create entry for `ACT-6156-AT` in ExpId.cs file as `ACT_6156_AT` as key and `ACT-6156-AT` as value.
- Create a new behavios object in `BehaviorExperiments.cs` file with name `AppHomeAirportTransferLandingToATGks` and add it to `BehaviorModelMapping.ExperimentToBehaviorMapping`.
- Then add `AppHomeAirportTransferLandingToATGks` to `FeatureName.ts` directory.
