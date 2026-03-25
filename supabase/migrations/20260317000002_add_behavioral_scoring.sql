-- Adiciona campos de scoring comportamental na tabela leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_behavioral int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_whatsapp_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_response_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_response_time_minutes int;

-- Atualiza calculate_lead_score para incluir score comportamental
CREATE OR REPLACE FUNCTION public.update_behavioral_score(p_lead_id uuid)
RETURNS void AS $$
DECLARE
  v_response_count int;
  v_last_response timestamptz;
  v_days_since_response float;
  v_score int := 0;
BEGIN
  -- Conta respostas inbound do lead no WhatsApp
  SELECT
    COUNT(*),
    MAX(created_at)
  INTO v_response_count, v_last_response
  FROM public.whatsapp_messages
  WHERE lead_id = p_lead_id AND direction = 'inbound';

  -- Score por quantidade de respostas (max 15)
  v_score := LEAST(v_response_count * 3, 15);

  -- Bônus por resposta recente
  IF v_last_response IS NOT NULL THEN
    v_days_since_response := EXTRACT(EPOCH FROM (NOW() - v_last_response)) / 86400;
    IF v_days_since_response <= 1 THEN v_score := v_score + 10;
    ELSIF v_days_since_response <= 3 THEN v_score := v_score + 5;
    ELSIF v_days_since_response <= 7 THEN v_score := v_score + 2;
    ELSIF v_days_since_response > 14 THEN v_score := GREATEST(v_score - 5, 0);
    END IF;
  END IF;

  v_score := LEAST(v_score, 25);

  UPDATE public.leads
  SET
    score_behavioral = v_score,
    last_whatsapp_response_at = v_last_response,
    whatsapp_response_count = v_response_count,
    score_total = LEAST(score_decision + score_urgency + score_assets + score_fit + v_score, 100),
    classification = CASE
      WHEN LEAST(score_decision + score_urgency + score_assets + score_fit + v_score, 100) >= 70 THEN 'estrategico'
      WHEN LEAST(score_decision + score_urgency + score_assets + score_fit + v_score, 100) >= 40 THEN 'qualificado'
      ELSE 'morno'
    END
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar score comportamental ao receber mensagem
CREATE OR REPLACE FUNCTION public.trg_update_behavioral_on_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.direction = 'inbound' THEN
    PERFORM public.update_behavioral_score(NEW.lead_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_behavioral_score ON public.whatsapp_messages;
CREATE TRIGGER trg_behavioral_score
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_update_behavioral_on_message();

-- Inicializa score comportamental para leads existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lead_id FROM public.whatsapp_messages WHERE lead_id IS NOT NULL LOOP
    PERFORM public.update_behavioral_score(r.lead_id);
  END LOOP;
END;
$$;
