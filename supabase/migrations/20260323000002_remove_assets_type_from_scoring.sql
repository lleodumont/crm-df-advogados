-- Remove bônus de tipo de bens do cálculo de score
-- O Pilar Patrimônio passa a ser calculado apenas pela faixa de valor dos bens
CREATE OR REPLACE FUNCTION public.calculate_lead_score(p_lead_id uuid)
RETURNS void AS $$
DECLARE
  v_stage text;
  v_timeline text;
  v_authority text;
  v_urgency_now text;
  v_risk_15d text;
  v_assets_range text;
  v_offer_fit text;

  s_decision int := 0;
  s_urgency int := 0;
  s_assets int := 0;
  s_fit int := 0;
  s_total int := 0;
  tmp int := 0;
BEGIN
  -- PILAR DECISÃO (0-40)
  v_stage := COALESCE(
    public.get_latest_answer(p_lead_id, 'decisao_real'),
    public.get_latest_answer(p_lead_id, 'stage')
  );
  IF v_stage IN ('decidi_estruturar', 'tomada') THEN s_decision := s_decision + 25;
  ELSIF v_stage IN ('quase_decidido', 'possibilidade_reconciliar') THEN s_decision := s_decision + 15;
  ELSIF v_stage IN ('avaliando', 'apenas_avaliando') THEN s_decision := s_decision + 5;
  END IF;

  v_timeline := COALESCE(
    public.get_latest_answer(p_lead_id, 'timeline_real'),
    public.get_latest_answer(p_lead_id, 'timeline_start')
  );
  IF v_timeline IN ('ate_7_dias', 'imediato') THEN s_decision := s_decision + 10;
  ELSIF v_timeline IN ('ate_30_dias', 'curto') THEN s_decision := s_decision + 5;
  END IF;

  v_authority := COALESCE(
    public.get_latest_answer(p_lead_id, 'autoridade_real'),
    public.get_latest_answer(p_lead_id, 'authority')
  );
  IF v_authority IN ('decido_sozinho', 'total') THEN s_decision := s_decision + 5;
  ELSIF v_authority IN ('preciso_alinhar', 'parcial') THEN s_decision := s_decision + 3;
  ELSIF v_authority IN ('nao_sei', 'nenhuma') THEN s_decision := s_decision + 1;
  END IF;

  IF s_decision > 40 THEN s_decision := 40; END IF;

  -- PILAR URGÊNCIA (0-30)
  v_urgency_now := public.get_latest_answer(p_lead_id, 'urgencia_real');
  IF v_urgency_now IS NOT NULL AND v_urgency_now != '' THEN
    IF v_urgency_now = 'alta' THEN s_urgency := 30;
    ELSIF v_urgency_now = 'media' THEN s_urgency := 15;
    ELSIF v_urgency_now = 'baixa' THEN s_urgency := 5;
    END IF;
  ELSE
    v_urgency_now := public.get_latest_answer(p_lead_id, 'urgency_now');
    v_risk_15d := public.get_latest_answer(p_lead_id, 'risk_15d');
    tmp := 0;
    IF public.has_token(v_urgency_now, 'ja_existe_processo') THEN tmp := tmp + 15; END IF;
    IF public.has_token(v_urgency_now, 'ameaca_processo') THEN tmp := tmp + 10; END IF;
    IF public.has_token(v_urgency_now, 'conflito_bens') THEN tmp := tmp + 8; END IF;
    IF public.has_token(v_urgency_now, 'disputa_filhos') THEN tmp := tmp + 8; END IF;
    IF v_risk_15d = 'sim' THEN tmp := tmp + 10;
    ELSIF v_risk_15d = 'talvez' THEN tmp := tmp + 5;
    END IF;
    s_urgency := LEAST(tmp, 30);
  END IF;

  -- PILAR PATRIMÔNIO (0-25) — baseado apenas na faixa de valor
  v_assets_range := COALESCE(
    public.get_latest_answer(p_lead_id, 'valor_bens_real'),
    public.get_latest_answer(p_lead_id, 'assets_range')
  );

  IF v_assets_range IN ('acima_1m', 'acima_5m', '1m_5m') THEN s_assets := 25;
  ELSIF v_assets_range IN ('500k_1m') THEN s_assets := 18;
  ELSIF v_assets_range IN ('200k_500k', '100k_500k') THEN s_assets := 10;
  ELSIF v_assets_range IN ('ate_200k', 'abaixo_100k') THEN s_assets := 4;
  END IF;

  -- PILAR FIT (0-5)
  v_offer_fit := public.get_latest_answer(p_lead_id, 'offer_fit');
  IF v_offer_fit = 'conducao_completa' THEN s_fit := 5;
  ELSIF v_offer_fit = 'nao_sei' THEN s_fit := 2;
  ELSE s_fit := 0;
  END IF;

  s_total := s_decision + s_urgency + s_assets + s_fit;
  IF s_total > 100 THEN s_total := 100; END IF;

  UPDATE public.leads
  SET score_decision = s_decision,
      score_urgency = s_urgency,
      score_assets = s_assets,
      score_fit = s_fit,
      score_total = s_total,
      classification = CASE
        WHEN s_total >= 70 THEN 'estrategico'
        WHEN s_total >= 40 THEN 'qualificado'
        ELSE 'morno'
      END
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;
