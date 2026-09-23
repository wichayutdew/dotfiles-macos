-- Top 5 activities per supplier × category by bookings in last 90 days
-- Run against StarRocks (connection_id: 393) to generate sample-ids.txt
SELECT
  t.activity_id,
  t.activity_title,
  t.activity_main_category_name,
  t.supplier_name,
  t.booking_cnt
FROM (
  SELECT
    d.activity_id,
    d.activity_title,
    d.activity_main_category_name,
    d.supplier_name,
    COUNT(b.booking_id) AS booking_cnt,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.supplier_name,
        d.activity_main_category_name
      ORDER BY COUNT(b.booking_id) DESC
    ) AS rn
  FROM bi_dw.dim_activity d
  JOIN bi_dw.fact_booking_activity b
    ON d.activity_id = b.activity_id
  WHERE d.activity_servable = TRUE
    AND b.booking_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND d.activity_main_category_name IS NOT NULL
  GROUP BY
    d.activity_id,
    d.activity_title,
    d.activity_main_category_name,
    d.supplier_name
) t
WHERE t.rn <= 5
