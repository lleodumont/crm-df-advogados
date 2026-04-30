/*
  Fix trigger trg_whatsapp_to_activity
  - Antes: falhava com NOT NULL constraint quando lead_id era null
  - Agora: só cria atividade se lead_id não for null
*/

CREATE OR REPLACE FUNCTION public.trg_whatsapp_to_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Só cria atividade se o lead existir (lead_id não nulo)
  IF NEW.lead_id IS NOT NULL THEN
    INSERT INTO public.activities (lead_id, type, channel, content, created_at)
    VALUES (
      NEW.lead_id,
      CASE WHEN NEW.direction = 'inbound' THEN 'msg_received' ELSE 'msg_sent' END::text,
      'whatsapp',
      NEW.content,
      NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
