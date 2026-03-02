/*
  # Add get_whatsapp_conversations function

  1. New Functions
    - `get_whatsapp_conversations()` - Returns a list of WhatsApp conversations grouped by lead
      - Aggregates messages by lead_id
      - Shows last message, timestamp, and unread count
      - Orders by most recent message first

  2. Purpose
    - Provides an optimized view of WhatsApp conversations for the frontend
    - Groups messages by lead and shows conversation preview
    - Includes unread message count for each conversation
*/

CREATE OR REPLACE FUNCTION get_whatsapp_conversations()
RETURNS TABLE (
  lead_id uuid,
  lead_name text,
  lead_phone text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint,
  last_message_direction text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id as lead_id,
    l.full_name as lead_name,
    l.phone as lead_phone,
    (
      SELECT content 
      FROM whatsapp_messages wm2 
      WHERE wm2.lead_id = l.id 
      ORDER BY wm2.created_at DESC 
      LIMIT 1
    ) as last_message,
    (
      SELECT created_at 
      FROM whatsapp_messages wm2 
      WHERE wm2.lead_id = l.id 
      ORDER BY wm2.created_at DESC 
      LIMIT 1
    ) as last_message_time,
    (
      SELECT COUNT(*) 
      FROM whatsapp_messages wm2 
      WHERE wm2.lead_id = l.id 
        AND wm2.direction = 'inbound'
        AND wm2.status != 'read'
    ) as unread_count,
    (
      SELECT direction::text 
      FROM whatsapp_messages wm2 
      WHERE wm2.lead_id = l.id 
      ORDER BY wm2.created_at DESC 
      LIMIT 1
    ) as last_message_direction
  FROM leads l
  WHERE EXISTS (
    SELECT 1 
    FROM whatsapp_messages wm 
    WHERE wm.lead_id = l.id
  )
  ORDER BY last_message_time DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;