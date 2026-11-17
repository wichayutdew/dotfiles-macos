# Feature Sign-off Template

Based on Confluence template: https://agoda.atlassian.net/wiki/spaces/ACV/pages/2270102146/Sign-off-automate-test

## Metadata Table

| **Field** | **Value** |
| --- | --- |
| **Date created** | {date} |
| **Epic Jira link** | {epic_link} |
| **Figma** | {figma_link} |
| **Experiment** | {experiment_id} {calculon_link} |
| **Behavior Name** | {behavior_name} |
| **RFC document** | {rfc_link} |
| **Configuration Name** | {config_name} [Optional] Only for mobile app |
| **Min version** | {min_version} [Optional] Only for mobile app |
| **CID** | {cid} [Optional] |
| **Slack link** | {slack_link} [Optional] |
| **Scope** | {scope} |
| **Platforms** | {platforms} (Web / iOS / Android / All) |
| **Estimated Complexity** | {complexity} (High / Medium / Low) |

## ✨ Feature Details

* **Feature Description**: {feature_description}
* **Experiment Goals**: {experiment_goals}
* **Acceptance Criteria**: {acceptance_criteria}
* **User Journey**: {user_journey}

## 🎨 Design References

* **Figma File**: {figma_link}
* **Key Components**: {key_components}
* **Interaction States**: {interaction_states} (default, hover, active, disabled, error, loading)
* **Responsive Behavior**: {responsive_behavior} (Mobile, tablet, desktop considerations)

## 🏗️ Technical Context

### Affected Repositories

| Repository | Language | Modules/Areas Affected | Changes |
|---|---|---|---|
| {repo_name} | {language} | {modules} | {changes_summary} |

### Dependencies

* **Internal Services**: {internal_services}
* **External APIs**: {external_apis}
* **Infrastructure**: {infrastructure} (databases, queues, caches)
* **Feature Flags**: {feature_flags}

### Integration Points

{integration_points}

## ✅ Check point

- [ ] Mobile First ? - No extra logic/design between Mobile and Desktop unless have logical data support
- [ ] Above the fold design concept ? -  Make sure the most engaging content is above the fold
- [ ] Corner cases ? - e.g. data amount, size of content on component
- [ ] Should only use DroneJs + Color from WL palette
- [ ] Legal risk ? - Copy wording, CMA compliance, PII exposure
- [ ] Language and Currency ? - RTL and long digits currency support
- [ ] Experiment and behavior management? - Under exp/feature switch (use /dev-add-experiment skill, Calculon: http://calculon.agodadev.io/)
- [ ] Accessibility ? - Focus descendent, contrast ratio, aria-label
- [ ] Tracking ? - What behavior needs analyze?, what's the customer usage hypothesis 
- [ ] Monitoring ? - Logging and monitoring. Setting up threshold
- [ ] Test strategy - How are we going to test the feature
- [ ] Content availability - Supplier data, API ready

## 💟 Test Scenario

### Quick Reference Table

| **Test Scenario** | **ACT-XXX=A** | **ACT-XXX=B Desktop** | **ACT-XXX=B Mobile Web** | **ACT-XXX=B App** | **ACT-XXX=B With Translation** |
| --- | --- | --- | --- | --- | --- |
| {test_scenario_1} | [ ] | [ ] | [ ] | [ ] | [ ] |
| {test_scenario_2} | [ ] | [ ] | [ ] | [ ] | [ ] |

### Detailed Test Scenarios

#### Scenario 1: {scenario_name}

* **Description**: {what_this_tests}
* **Pre-conditions**: {setup_needed}
* **Test Steps**:
  1. {step_1}
  2. {step_2}
  3. {step_3}
* **Expected Result**: {expected_outcome}
* **Evidence Required**: {screenshot_video_log}
* **Acceptance Criteria Covered**: {ac_reference}

#### Scenario 2: {scenario_name}

* **Description**: {what_this_tests}
* **Pre-conditions**: {setup_needed}
* **Test Steps**:
  1. {step_1}
  2. {step_2}
* **Expected Result**: {expected_outcome}
* **Evidence Required**: {screenshot_video_log}
* **Acceptance Criteria Covered**: {ac_reference}

## 🧑🏻‍💻 E2E Feature & Snapshot Test 

| Test Case Name |  **Note** |
| --- | --- |
| {test_case_name} | {note} |

## 🔄 Regression Testing

Areas that need regression testing based on changes:

* {existing_feature_1} - shares components/APIs
* {existing_feature_2} - affected by this change

## ⚡ Performance Testing

* **Load testing requirements**: {load_requirements}
* **Expected metrics**: {expected_metrics}
* **Baseline vs target**: {baseline_target}
* **Thresholds**: {performance_thresholds}

## 🛢️ Data source & Store Procs 

| **Data source** |  **Repo** | **SP Name** |
| --- | --- | --- |
| {data_source} | {repo} | {sp_name} |

## 🈚️ CMS Translation

**Note**: Only include if CMS translations are required. Otherwise, omit this section.

| **CMS ID** |  **Translation** |
| --- | --- |
| {cms_id} | {translation} |

## 🌐 WhiteLabeling

**WL MR**: {wl_mr_link}

## 🕵️ Sanity Testing on Most Booked Activities

Execute this query on Superset with Vertica as datasource and bi_dw as schema and fill the tables with sanity testing result on Top 10 most booked activities.

| **Activity ID**  | **A side URL** | **When ACTX=A** | **B side URL** | **When ACTX=B** | Remarks |
| --- | --- | --- | --- | --- | --- |
| {activity_id} | {url_a} | [ ] | {url_b} | [ ] | {remarks} |

## ⚡️ Web Analytics 

**Analytics MR**: {analytics_mr_link}

| Component | Action Type | Action Element Name | Custom Fields | Screenshot |
| --- | --- | --- | --- | --- |
| {component} | {action_type} | {action_element} | {custom_fields} | {screenshot} |

## ♿️ Accessibility

**Note**: Only include if accessibility requirements are mentioned. Otherwise, omit this section.

| Topic | Figma | Screenshot | Remarks |
| --- | --- | --- | --- |
| {topic} | {figma_link} | {screenshot} | {remarks} |

## 📊 Post-Launch Monitoring Plan

* **Monitoring Metrics**: {monitoring_metrics}
* **Monitoring Tools**: {monitoring_tools}
* **Alert Thresholds**: {alert_thresholds}

## 🐞 Known issues

| **Issues** | **Jira ID** |
| --- | --- |
| {issue} | {jira_id} |

## 🚫 Out of Scope

Explicitly list what is NOT included to prevent scope creep:

* {out_of_scope_1}
* {out_of_scope_2}

## ❓ Questions and Clarifications

Any remaining ambiguities or questions that came up during research:

* {question_1}
* {question_2}

## 👩🏻‍💻 Stakeholder Approvals

| **Stakeholder** | **Name** | **Date Approved** |
| --- | --- | --- |
| Designer | {designer_name} | {date} |
| Product Owner | {po_name} | {date} |
| Engineering Lead | {tech_lead_name} | {date} |

## 📚 References

* **JIRA Epic**: {epic_link}
* **Figma Designs**: {figma_links}
* **Technical Docs**: {glean_doc_links}
* **Slack Discussions**: {slack_thread_links}
* **Grafana Dashboards**: {grafana_dashboard_links}
* **Related MRs**: {related_mr_links}

---

**Document Generated**: {generated_date}
**Last Updated**: {updated_date}
