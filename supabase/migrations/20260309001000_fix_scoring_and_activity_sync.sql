-- 1. Criar função para sincronizar mensagens de WhatsApp com Atividades
CREATE OR REPLACE FUNCTION public.trg_whatsapp_to_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activities (lead_id, type, channel, content, created_at)
  VALUES (
    NEW.lead_id, 
    CASE WHEN NEW.direction = 'inbound' THEN 'msg_received' ELSE 'msg_sent' END::text,
    'whatsapp',
    NEW.content,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_message_activity ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_message_activity
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_whatsapp_to_activity();

-- 2. Corrigir e Renomear a função de Score (Lógica Híbrida)
-- Nota: Mantemos o nome recalculate_lead_score por segurança com os triggers existentes, 
-- mas criamos um alias ou renomeamos se necessário. Vou apenas garantir que ela entenda as novas chaves.

CREATE OR REPLACE FUNCTION public.calculate_lead_score(p_lead_id uuid)
RETURNS void AS $$
DECLARE
  v_stage text;
  v_timeline text;
  v_authority text;
  v_urgency_now text;
  v_risk_15d text;
  v_assets_types text;
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
  -- Prioridade: Triagem Humana (decisao_real) -> Meta Ads (stage)
  v_stage := COALESCE(
    public.get_latest_answer(p_lead_id, 'decisao_real'),
    public.get_latest_answer(p_lead_id, 'stage')
  );
  
  -- Mapeamento Decisão
  IF v_stage IN ('decidi_estruturar', 'tomada') THEN s_decision := s_decision + 25;
  ELSIF v_stage IN ('quase_decidido', 'possibilidade_reconciliar') THEN s_decision := s_decision + 15;
  ELSIF v_stage IN ('avaliando', 'apenas_avaliando') THEN s_decision := s_decision + 5;
  END IF;

  -- Prioridade: Triagem Humana (timeline_real) -> Meta Ads (timeline_start)
  v_timeline := COALESCE(
    public.get_latest_answer(p_lead_id, 'timeline_real'),
    public.get_latest_answer(p_lead_id, 'timeline_start')
  );
  
  -- Mapeamento Timeline
  IF v_timeline IN ('ate_7_dias', 'imediato') THEN s_decision := s_decision + 10;
  ELSIF v_timeline IN ('ate_30_dias', 'curto') THEN s_decision := s_decision + 5;
  END IF;

  -- Prioridade: Triagem Humana (autoridade_real) -> Meta Ads (authority)
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
  -- Prioridade: Triagem Humana (urgencia_real) -> Meta Ads (urgency_now + risk_15d)
  v_urgency_now := public.get_latest_answer(p_lead_id, 'urgencia_real');
  
  IF v_urgency_now IS NOT NULL AND v_urgency_now != '' THEN
    IF v_urgency_now = 'alta' THEN s_urgency := 30;
    ELSIF v_urgency_now = 'media' THEN s_urgency := 15;
    ELSIF v_urgency_now = 'baixa' THEN s_urgency := 5;
    END IF;
  ELSE
    -- Fallback Meta Ads
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

  -- PILAR PATRIMÔNIO (0-25)
  -- Prioridade: Triagem Humana (valor_bens_real) -> Meta Ads (assets_range)
  v_assets_range := COALESCE(
    public.get_latest_answer(p_lead_id, 'valor_bens_real'),
    public.get_latest_answer(p_lead_id, 'assets_range')
  );

  tmp := 0;
  IF v_assets_range IN ('acima_1m', 'acima_5m', '1m_5m') THEN tmp := tmp + 20; -- Bonus p/ alta renda
  ELSIF v_assets_range IN ('500k_1m') THEN tmp := tmp + 12;
  ELSIF v_assets_range IN ('200k_500k', '100k_500k') THEN tmp := tmp + 7;
  ELSIF v_assets_range IN ('ate_200k', 'abaixo_100k') THEN tmp := tmp + 3;
  END IF;

  -- Tipo de bens (Mix Humano/Meta)
  v_assets_types := COALESCE(
    public.get_latest_answer(p_lead_id, 'tipo_bens_real'),
    public.get_latest_answer(p_lead_id, 'assets_types')
  );
  
  IF public.has_token(v_assets_types, 'empresa_cotas') OR public.has_token(v_assets_types, 'empresas') THEN tmp := tmp + 10; END IF;
  IF public.has_token(v_assets_types, 'imovel_financiado') THEN tmp := tmp + 7; END IF;
  
  s_assets := LEAST(tmp, 25);

  -- PILAR FIT (0-5)
  v_offer_fit := public.get_latest_answer(p_lead_id, 'offer_fit');
  IF v_offer_fit = 'conducao_completa' THEN s_fit := 5;
  ELSIF v_offer_fit = 'nao_sei' THEN s_fit := 2;
  ELSE s_fit := 0;
  END IF;

  s_total := s_decision + s_urgency + s_assets + s_fit;
  IF s_total > 100 THEN s_total := 100; END IF;
-- 4. Criar triggers de atividade para Propostas e Reuniões
CREATE OR REPLACE FUNCTION public.trg_proposal_to_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (lead_id, type, channel, content, created_at)
    VALUES (NEW.lead_id, 'proposal_created', 'internal', 'Proposta criada: ' || NEW.title || ' (R$ ' || COALESCE(NEW.value, 0) || ')', NEW.created_at);
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    INSERT INTO public.activities (lead_id, type, channel, content, created_at)
    VALUES (NEW.lead_id, 'proposal_update', 'internal', 'Status da proposta alterado para: ' || NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_activity ON public.proposals;
CREATE TRIGGER trg_proposal_activity
AFTER INSERT OR UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.trg_proposal_to_activity();

CREATE OR REPLACE FUNCTION public.trg_meeting_to_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activities (lead_id, type, channel, content, created_at)
    VALUES (NEW.lead_id, 'meeting_scheduled', 'internal', 'Reunião agendada: ' || NEW.title || ' em ' || NEW.start_time, NEW.created_at);
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    INSERT INTO public.activities (lead_id, type, channel, content, created_at)
    VALUES (NEW.lead_id, 'meeting_update', 'internal', 'Status da reunião alterado para: ' || NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meeting_activity ON public.meetings;
CREATE TRIGGER trg_meeting_activity
AFTER INSERT OR UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.trg_meeting_to_activity();

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

-- 3. Redirecionar recalculate_lead_score para a nova calculate_lead_score
CREATE OR REPLACE FUNCTION public.recalculate_lead_score(p_lead_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM public.calculate_lead_score(p_lead_id);
END;
$$ LANGUAGE plpgsql;
