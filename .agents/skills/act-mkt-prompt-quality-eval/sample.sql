-- Top N servable activities by booking volume in last 90 days
-- Run against StarRocks. Adjust LIMIT value as needed (default 10000).
-- Output: activity_id, activity_title, booking_cnt
--
-- Usage:
--   1. Connect to StarRocks (connection_id: 393)
--   2. Run this query
--   3. Export results to sample-ids.txt (one activity_id per line)

SELECT
  d.activity_id,
  d.activity_title,
  COUNT(b.booking_id) AS booking_cnt
FROM bi_dw.dim_activity d
JOIN bi_dw.fact_booking_activity b
  ON d.activity_id = b.activity_id
WHERE d.activity_servable = TRUE
  AND d.rec_status = 1
  AND b.booking_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY d.activity_id, d.activity_title
ORDER BY booking_cnt DESC
LIMIT 10000;
