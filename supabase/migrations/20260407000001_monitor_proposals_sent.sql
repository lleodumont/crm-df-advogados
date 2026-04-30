-- RPC: propostas enviadas sem resposta do lead
CREATE OR REPLACE FUNCTION monitor_proposals_sent()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  score_total integer,
  last_message text,
  sent_at timestamptz,
  hours_without_response numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    l.id,
    l.full_name,
    l.phone,
    l.score_total,
    wm_last.content    AS last_message,
    wm_last.created_at AS sent_at,
    ROUND(EXTRACT(EPOCH FROM (now() - wm_last.created_at)) / 3600, 1) AS hours_without_response
  FROM leads l
  JOIN LATERAL (
    SELECT content, created_at, direction
    FROM whatsapp_messages
    WHERE lead_id = l.id
    ORDER BY created_at DESC
    LIMIT 1
  ) wm_last ON true
  WHERE l.status = 'proposta_enviada'
    AND wm_last.direction = 'outbound'
  ORDER BY wm_last.created_at ASC;
$$;
