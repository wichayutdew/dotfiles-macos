SELECT DISTINCT
  e.esc_id,
  e.esc_name,
  e.esc_status,
  e.esc_start_at_str,
  e.rotation_name,
  n.channel_id,
  n.mainthreadts,
  CASE
    WHEN n.channel_id IS NOT NULL AND n.mainthreadts IS NOT NULL
    THEN CONCAT('https://agoda.slack.com/archives/', n.channel_id,
                '/p', REPLACE(n.mainthreadts, '.', ''))
  END AS slack_thread_url
FROM it_opd.escalation e
JOIN (
  SELECT DISTINCT esc_id
  FROM it_opd.esc_notification
  WHERE master = 'master' AND rotation_id = {rotation_id}
) r ON e.esc_id = r.esc_id
LEFT JOIN it_opd.esc_notification n
  ON e.esc_id = n.esc_id
  AND n.master = 'master'
  AND n.rotation_id = {rotation_id}
  AND n.type = 'SLACK'
WHERE e.master = 'master'
  AND e.esc_start_at_str >= '{start_at}'
  AND e.esc_start_at_str < '{end_exclusive}'
