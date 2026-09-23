-- Top 10K activities by all-time booking count
-- Run against StarRocks to generate activity IDs file for trigger.js
-- Source table: agoda_activities.activity_booking_summary
SELECT
  a.activity_id
FROM agoda_activities.activity_booking_summary a
JOIN bi_dw.dim_activity d
  ON a.activity_id = d.activity_id
WHERE d.activity_servable = TRUE
ORDER BY a.booking_count_all_time DESC
LIMIT 10000
