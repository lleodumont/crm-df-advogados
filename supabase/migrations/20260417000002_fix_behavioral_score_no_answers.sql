-- Leads sem respostas de formulário não devem receber score comportamental
CREATE OR REPLACE FUNCTION public.update_behavioral_score(p_lead_id uuid)
RETURNS void AS $$
DECLARE
  v_has_answers     boolean;
  v_response_count  int;
  v_last_response   timestamptz;
  v_days_since      float;
  v_score           int := 0;
BEGIN
  -- Regra: sem respostas de formulário = score total zerado, não tocar
  SELECT EXISTS(
    SELECT 1 FROM public.lead_answers
    WHERE lead_id = p_lead_id
      AND question_key IN ('cargo', 'num_colaboradores', 'faturamento_mensal')
  ) INTO v_has_answers;

  IF NOT v_has_answers THEN
    -- Garante score comportamental zerado sem alterar os outros pilares
    UPDATE public.leads
    SET score_behavioral = 0,
        score_total = 0,
        classification = 'morno'
    WHERE id = p_lead_id;
    RETURN;
  END IF;

  SELECT COUNT(*), MAX(created_at)
  INTO v_response_count, v_last_response
  FROM public.whatsapp_messages
  WHERE lead_id = p_lead_id AND direction = 'inbound';

  v_score := LEAST(v_response_count * 3, 15);

  IF v_last_response IS NOT NULL THEN
    v_days_since := EXTRACT(EPOCH FROM (NOW() - v_last_response)) / 86400;
    IF v_days_since <= 1 THEN v_score := v_score + 10;
    ELSIF v_days_since <= 3 THEN v_score := v_score + 5;
    ELSIF v_days_since <= 7 THEN v_score := v_score + 2;
    ELSIF v_days_since > 14 THEN v_score := GREATEST(v_score - 5, 0);
    END IF;
  END IF;

  v_score := LEAST(v_score, 25);

  UPDATE public.leads
  SET score_behavioral = v_score,
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

-- Recalcula todos os leads sem respostas para zerar o score comportamental
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT l.id
    FROM public.leads l
    WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_answers la
      WHERE la.lead_id = l.id
        AND la.question_key IN ('cargo', 'num_colaboradores', 'faturamento_mensal')
    )
  LOOP
    PERFORM public.update_behavioral_score(r.id);
  END LOOP;
END $$;
