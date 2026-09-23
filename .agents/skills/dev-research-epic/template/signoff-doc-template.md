```markdown
# Epic Sign-Off: [Epic ID] [Epic Title]

## Executive Summary

- **Epic**: [ACT-XXXX](https://agoda.atlassian.net/browse/ACT-XXXX)
- **Status**: Ready for Breakdown
- **Scope**: [One-line description]
- **Platforms**: [Web / iOS / Android / All]
- **Estimated Complexity**: [High / Medium / Low]

## Business Context

[Why are we building this? What problem does it solve? What's the expected impact?]

## Requirements Summary

### Requirements

1. [Requirement 1 from JIRA, Figma, discussions]
2. [Requirement 2]
3. ...

**Note**: Do NOT split into "Functional Requirements" and "Non-Functional Requirements". Keep all requirements in a single list to avoid confusion.

### Acceptance Criteria (from JIRA)

[List all ACs from customfield_10096 with verification method]

- [ ] AC1: [Description]
  - Verification: [How to test]
- [ ] AC2: [Description]
  - Verification: [How to test]

## Design References

[Embed or link Figma screenshots saved in Phase 1]

- **Figma File**: [Link]
- **Key Components**: [List components and design system elements]
- **Interaction States**: [List states: default, hover, active, disabled, error, loading]
- **Responsive Behavior**: [Mobile, tablet, desktop considerations]

## Technical Context

### Affected Repositories

| Repository | Language | Modules/Areas Affected | Local? |
|---|---|---|---|
| [repo-name] | [Scala/TS/etc] | [specific modules] | Yes/No |

### Existing Patterns

[Document patterns from Phase 1.4 that should be followed]

### Dependencies

- **Internal Services**: [List services this feature depends on]
- **External APIs**: [Third-party integrations]
- **Infrastructure**: [New infrastructure needed: databases, queues, caches]
- **Feature Flags**: [Required flags for gradual rollout]

### Integration Points

[How this feature connects with existing systems, based on Phase 2 validation]

## Test Strategy

### Test Scenarios

For each major requirement, create detailed test scenarios:

#### Scenario 1: [Happy Path - Primary User Flow]

- **Description**: [What this tests]
- **Pre-conditions**: [Setup needed]
- **Test Steps**:
  1. [Step 1]
  2. [Step 2]
  3. ...
- **Expected Result**: [What should happen]
- **Evidence Required**: [Screenshot / Video / API response / Log output]
- **Acceptance Criteria Covered**: [Reference AC from above]

#### Scenario 2: [Edge Case - Error Handling]

[Same structure]

#### Scenario 3: [Boundary Condition]

[Same structure]

### Regression Testing

[Areas that need regression testing based on changes]

- [Existing feature 1 that shares components]
- [Existing feature 2 that uses same APIs]

### Performance Testing

[If applicable, based on Grafana analysis]

- Load testing requirements
- Expected metrics and thresholds
- Baseline vs target performance

## Story Breakdown

[Include the approved breakdown from Phase 3]

**Use the same table format chosen in Phase 3.1** (Format A or Format B from dev-jira-ticket skill template format `${CLAUDE_PLUGIN_ROOT}/skills/dev-jira-ticket/SKILL.md`)

### Implementation Phases

Group stories by logical phases and describe parallelization strategy. Include parallel execution waves showing which stories can run simultaneously.

## ✅ Check Point

Before proceeding with implementation, verify:

**Design & UX:**
- [ ] Mobile First? - No extra logic/design between Mobile and Desktop unless have logical data support
- [ ] Above the fold design concept? - Make sure the most engaging content is above the fold
- [ ] Corner cases? - e.g. data amount, size of content on component
- [ ] Should only use DroneJs + Color from WL palette
- [ ] Legal risk? - Copy wording, CMA compliance, PII exposure
- [ ] Language and Currency? - RTL and long digits currency support

**Technical:**
- [ ] Experiment and behavior management? - Under exp/feature switch (please use ${CLAUDE_PLUGIN_ROOT}/skills/dev-add-experiment/SKILL.md for the experiment setup) (Calculon setup: http://calculon.agodadev.io/)
- [ ] Accessibility? - Focus descendent, contrast ratio, aria-label
- [ ] Tracking? - What behavior needs analyze?, what's the customer usage hypothesis
- [ ] Monitoring? - Logging and monitoring. Setting up threshold
- [ ] Test strategy - How are we going to test the feature
- [ ] Content availability - Supplier data, API ready

## 💟 Test Scenarios

[Include detailed test scenarios from above Test Strategy section]

## 🈚️ CMS Translation

**Note**: Only include this section if CMS translations are mentioned in the epic or requirements. Otherwise, omit this section.

| **CMS ID** | **Translation** |
|---|---|
| [ID] | [Text] |

## ⚡️ Web Analytics

| **Component** | **Action Type** | **Action Element Name** | **Custom Fields** | **Screenshot** |
|---|---|---|---|---|
| [Component name] | Seen, Click | [element-name] | [custom fields] | [Link or embed] |

## ♿️ Accessibility

**Note**: Only include this section if accessibility requirements are mentioned in the epic or Figma designs. Otherwise, omit this section.

| Topic | Screenshot | Remarks |
|---|---|---|
| Tab selection | [Screenshot] | Tab selection is correct |
| Keyboard navigation | [Screenshot] | All interactive elements are keyboard accessible |
| Screen reader | [Screenshot] | ARIA labels are properly set |

## 📊 Post-Launch Monitoring Plan

- **Monitoring Metrics**: [List metrics to monitor]
- **Monitoring Tools**: [Grafana dashboards, Loki queries, etc.]
- **Alert Thresholds**: [When to trigger alerts]

## 🐞 Known Issues

| **Issues** | **Jira ID** |
|---|---|
| [Issue description] | [ACT-XXXX] |

## 👩🏻‍💻 Stakeholder Approvals

| **Stakeholder** | **Name** | **Date Approved** |
|---|---|---|
| Designer | [@Name] | [Date] |
| Product Owner | [@Name] | [Date] |
| Engineering Lead | [@Name] | [Date] |

## Out of Scope

[Explicitly list what is NOT included to prevent scope creep]

- [Out of scope item 1]
- [Out of scope item 2]

## Questions and Clarifications

[Any remaining ambiguities or questions that came up during research]

## References

- **JIRA Epic**: [Link]
- **Figma Designs**: [Links]
- **Technical Docs**: [Glean document links]
- **Slack Discussions**: [Thread links]
- **Grafana Dashboards**: [Dashboard links]
- **Related PRs**: [If any prerequisite work exists]

---

**Document Generated**: [Date]
**Last Updated**: [Date]
```