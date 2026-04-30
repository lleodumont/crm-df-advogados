-- RPCs de monitoramento para o painel de WhatsApp

-- 1. Leads sem resposta (última mensagem foi deles, não nossa)
CREATE OR REPLACE FUNCTION monitor_no_response()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  status text,
  last_message text,
  last_message_at timestamptz,
  hours_waiting numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    l.id,
    l.full_name,
    l.phone,
    l.status,
    wm_last.content         AS last_message,
    wm_last.created_at      AS last_message_at,
    ROUND(EXTRACT(EPOCH FROM (now() - wm_last.created_at)) / 3600, 1) AS hours_waiting
  FROM leads l
  JOIN LATERAL (
    SELECT content, created_at, direction
    FROM whatsapp_messages
    WHERE lead_id = l.id
    ORDER BY created_at DESC
    LIMIT 1
  ) wm_last ON true
  WHERE wm_last.direction = 'inbound'
  ORDER BY wm_last.created_at ASC;
$$;

-- 2. Potenciais clientes com WhatsApp ativo (score >= 60)
CREATE OR REPLACE FUNCTION monitor_hot_leads()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  status text,
  score_total integer,
  last_message text,
  last_contact timestamptz,
  last_direction text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    l.id,
    l.full_name,
    l.phone,
    l.status,
    l.score_total,
    wm_last.content    AS last_message,
    wm_last.created_at AS last_contact,
    wm_last.direction  AS last_direction
  FROM leads l
  JOIN LATERAL (
    SELECT content, created_at, direction
    FROM whatsapp_messages
    WHERE lead_id = l.id
    ORDER BY created_at DESC
    LIMIT 1
  ) wm_last ON true
  WHERE l.score_total >= 60
  ORDER BY l.score_total DESC;
$$;

-- 3. Chats com áudios (transcritos e não transcritos)
CREATE OR REPLACE FUNCTION monitor_audio_chats()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  transcribed bigint,
  not_transcribed bigint,
  total_audios bigint,
  last_audio_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    l.id,
    l.full_name,
    l.phone,
    COUNT(*) FILTER (WHERE wm.transcription IS NOT NULL AND wm.transcription <> '') AS transcribed,
    COUNT(*) FILTER (WHERE wm.transcription IS NULL OR wm.transcription = '')       AS not_transcribed,
    COUNT(*)                                                                         AS total_audios,
    MAX(wm.created_at)                                                               AS last_audio_at
  FROM whatsapp_messages wm
  JOIN leads l ON l.id = wm.lead_id
  WHERE wm.message_type = 'audio'
  GROUP BY l.id, l.full_name, l.phone
  ORDER BY not_transcribed DESC, last_audio_at DESC;
$$;

-- 4. Chats onde ofertamos reunião mas ela ainda não foi agendada
CREATE OR REPLACE FUNCTION monitor_pending_meetings()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  status text,
  last_meeting_offer text,
  offered_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    l.id,
    l.full_name,
    l.phone,
    l.status,
    (
      SELECT content
      FROM whatsapp_messages
      WHERE lead_id = l.id
        AND direction = 'outbound'
        AND (
          LOWER(content) LIKE '%reuni%'    OR
          LOWER(content) LIKE '%agendar%'  OR
          LOWER(content) LIKE '%hor%rio%'  OR
          LOWER(content) LIKE '%disponib%' OR
          LOWER(content) LIKE '%consulta%'
        )
      ORDER BY created_at DESC
      LIMIT 1
    ) AS last_meeting_offer,
    (
      SELECT created_at
      FROM whatsapp_messages
      WHERE lead_id = l.id
        AND direction = 'outbound'
        AND (
          LOWER(content) LIKE '%reuni%'    OR
          LOWER(content) LIKE '%agendar%'  OR
          LOWER(content) LIKE '%hor%rio%'  OR
          LOWER(content) LIKE '%disponib%' OR
          LOWER(content) LIKE '%consulta%'
        )
      ORDER BY created_at DESC
      LIMIT 1
    ) AS offered_at
  FROM leads l
  WHERE EXISTS (
    SELECT 1 FROM whatsapp_messages
    WHERE lead_id = l.id
      AND direction = 'outbound'
      AND (
        LOWER(content) LIKE '%reuni%'    OR
        LOWER(content) LIKE '%agendar%'  OR
        LOWER(content) LIKE '%hor%rio%'  OR
        LOWER(content) LIKE '%disponib%' OR
        LOWER(content) LIKE '%consulta%'
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM scheduled_activities sa
    WHERE sa.lead_id = l.id
      AND sa.activity_type = 'meeting'
      AND sa.status = 'scheduled'
  )
  AND NOT EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.lead_id = l.id
      AND m.status = 'scheduled'
  )
  ORDER BY offered_at DESC;
$$;
