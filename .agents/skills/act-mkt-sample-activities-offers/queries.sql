-- Query templates for sample-activities-offers
-- Replace placeholders before running:
--   {days}                 → integer, e.g. 90
--   {sample_size}          → integer, e.g. 200
--   {segment_sample_size}  → integer (per-segment for stratified queries)
--   {country}              → activity destination country name, e.g. 'Thailand'
--   {category}             → category name, e.g. 'ATTRACTIONS'
--   {geography_filter}     → optional WHERE clause fragment for activity location, or remove line
--   {nationality_filter}   → optional WHERE clause fragment for customer nationality, or remove line
--
-- StarRocks syntax notes:
--   - Date arithmetic: DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)  ← correct
--   - NOT: CURRENT_DATE - INTERVAL '90 days'                    ← parse error
--   - Category: use d.activity_main_category_name from dim_activity (no dim_activity_category table)
--
-- Execution: preferred method is Superset MCP query_dataset (connection_id 393, format 'csv')

-- =====================================================================
-- top_bookings_activity_only
-- Output: activity_id,city_id,country_id,booking_count,country_name,city_name,category_name
-- =====================================================================
SELECT
  f.activity_id,
  d.city_id,
  d.country_id,
  COUNT(*) AS booking_count,
  d.country_name,
  d.city_name,
  d.activity_main_category_name AS category_name
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {geography_filter}
  {nationality_filter}
GROUP BY
  f.activity_id,
  d.city_id,
  d.country_id,
  d.country_name,
  d.city_name,
  d.activity_main_category_name
ORDER BY booking_count DESC
LIMIT {sample_size};

-- =====================================================================
-- top_bookings_activity_offer
-- Output: activity_id,offer_id,city_id,country_id,booking_count,country_name,city_name,category_name
-- =====================================================================
SELECT
  f.activity_id,
  f.offer_id,
  d.city_id,
  d.country_id,
  COUNT(*) AS booking_count,
  d.country_name,
  d.city_name,
  d.activity_main_category_name AS category_name
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {geography_filter}
  {nationality_filter}
GROUP BY
  f.activity_id,
  f.offer_id,
  d.city_id,
  d.country_id,
  d.country_name,
  d.city_name,
  d.activity_main_category_name
ORDER BY booking_count DESC
LIMIT {sample_size};

-- =====================================================================
-- geography_distribution
-- Step 1 for stratified-by-geography sampling.
-- Replace grouped columns with d.city_id, d.city_name for city-level stratification.
-- =====================================================================
SELECT
  d.country_id,
  d.country_name,
  COUNT(DISTINCT f.activity_id) AS activity_count
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {geography_filter}
  {nationality_filter}
GROUP BY d.country_id, d.country_name
ORDER BY activity_count DESC;

-- =====================================================================
-- stratified_geography_activity_only
-- Run once per country segment, then UNION ALL results.
-- =====================================================================
SELECT
  f.activity_id,
  d.city_id,
  d.country_id,
  COUNT(*) AS booking_count,
  d.country_name,
  d.city_name,
  d.activity_main_category_name AS category_name
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE d.country_name = '{country}'
  AND f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {nationality_filter}
GROUP BY
  f.activity_id,
  d.city_id,
  d.country_id,
  d.country_name,
  d.city_name,
  d.activity_main_category_name
ORDER BY RAND()
LIMIT {segment_sample_size};

-- =====================================================================
-- stratified_geography_activity_offer
-- Run once per country segment, then UNION ALL results.
-- =====================================================================
SELECT
  f.activity_id,
  f.offer_id,
  d.city_id,
  d.country_id,
  COUNT(*) AS booking_count,
  d.country_name,
  d.city_name,
  d.activity_main_category_name AS category_name
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE d.country_name = '{country}'
  AND f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {nationality_filter}
GROUP BY
  f.activity_id,
  f.offer_id,
  d.city_id,
  d.country_id,
  d.country_name,
  d.city_name,
  d.activity_main_category_name
ORDER BY RAND()
LIMIT {segment_sample_size};

-- =====================================================================
-- category_distribution
-- Step 1 for stratified-by-category sampling.
-- =====================================================================
SELECT
  d.activity_main_category_name AS category_name,
  COUNT(DISTINCT f.activity_id) AS activity_count
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {geography_filter}
  {nationality_filter}
GROUP BY d.activity_main_category_name
ORDER BY activity_count DESC;

-- =====================================================================
-- stratified_category_activity_only
-- Run once per category segment, then UNION ALL results.
-- =====================================================================
SELECT
  f.activity_id,
  d.city_id,
  d.country_id,
  COUNT(*) AS booking_count,
  d.country_name,
  d.city_name,
  d.activity_main_category_name AS category_name
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE d.activity_main_category_name = '{category}'
  AND f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {geography_filter}
  {nationality_filter}
GROUP BY
  f.activity_id,
  d.city_id,
  d.country_id,
  d.country_name,
  d.city_name,
  d.activity_main_category_name
ORDER BY RAND()
LIMIT {segment_sample_size};

-- =====================================================================
-- stratified_category_activity_offer
-- Run once per category segment, then UNION ALL results.
-- =====================================================================
SELECT
  f.activity_id,
  f.offer_id,
  d.city_id,
  d.country_id,
  COUNT(*) AS booking_count,
  d.country_name,
  d.city_name,
  d.activity_main_category_name AS category_name
FROM bi_dw.fact_booking_activity f
JOIN bi_dw.dim_activity d ON f.activity_id = d.activity_id
WHERE d.activity_main_category_name = '{category}'
  AND f.whitelabel_id = 1
  AND DATE(f.booking_date) >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)
  AND d.activity_servable = 1
  AND d.rec_status = 1
  {geography_filter}
  {nationality_filter}
GROUP BY
  f.activity_id,
  f.offer_id,
  d.city_id,
  d.country_id,
  d.country_name,
  d.city_name,
  d.activity_main_category_name
ORDER BY RAND()
LIMIT {segment_sample_size};
