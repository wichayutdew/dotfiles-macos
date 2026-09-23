# SQL Query Examples

## Top 10 Activities by Booking Count (Last 90 Days)

Run this query in **Superset** with **Vertica** datasource and **bi_dw** schema:

```sql
SELECT 
  fba.activity_id, 
  da.activity_title, 
  COUNT(DISTINCT fba.booking_id) AS booking_count,
  da.city_id, 
  da.activity_main_category_name AS activity_category
FROM bi_dw.fact_booking_activity fba
INNER JOIN bi_dw.dim_activity da 
  ON fba.activity_id = da.activity_id
WHERE fba.whitelabel_id = 1 
  AND da.activity_servable = 1 
  AND da.rec_status = 1
  AND fba.datadate >= CAST(DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 90 DAY), '%Y%m%d') AS INT)
GROUP BY 
  fba.activity_id, 
  da.activity_title, 
  da.city_id, 
  da.activity_main_category_name
ORDER BY booking_count DESC 
LIMIT 10;
```

### Expected Output Format

```
activity_id | activity_title                    | booking_count | city_id | activity_category
------------|-----------------------------------|---------------|---------|------------------
1252815     | Bangkok Grand Palace Tour         | 15234         | 2656    | Tours & Sightseeing
9876543     | Phuket Island Hopping             | 12890         | 3952    | Water Activities
...
```

## Alternative Query: Top Activities by City

If you want to test specific cities:

```sql
SELECT 
  fba.activity_id, 
  da.activity_title, 
  COUNT(DISTINCT fba.booking_id) AS booking_count,
  da.city_id,
  da.city_name
FROM bi_dw.fact_booking_activity fba
INNER JOIN bi_dw.dim_activity da 
  ON fba.activity_id = da.activity_id
WHERE fba.whitelabel_id = 1 
  AND da.activity_servable = 1 
  AND da.rec_status = 1
  AND da.city_id IN (2656, 3952, 1639) -- Bangkok, Phuket, Tokyo
  AND fba.datadate >= CAST(DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 90 DAY), '%Y%m%d') AS INT)
GROUP BY 
  fba.activity_id, 
  da.activity_title, 
  da.city_id,
  da.city_name
ORDER BY booking_count DESC 
LIMIT 5; -- Top 5 per city
```
