-- Insere respostas do formulário para Luciano Silva (df741aa3-f268-4cb1-becb-e35033748468)
-- Dados extraídos do CSV enviado pelo usuário
-- Usa INSERT ... WHERE NOT EXISTS para não duplicar se já existirem

DO $$
DECLARE
  v_lead_id uuid := 'df741aa3-f268-4cb1-becb-e35033748468';
BEGIN
  -- Só insere se o lead realmente existe
  IF NOT EXISTS (SELECT 1 FROM leads WHERE id = v_lead_id) THEN
    RAISE NOTICE 'Lead % não encontrado, pulando.', v_lead_id;
    RETURN;
  END IF;

  -- Insere cada resposta apenas se ainda não existir para aquela question_key
  INSERT INTO lead_answers (lead_id, question_key, answer_value, source)
  SELECT v_lead_id, q.key, q.val, 'meta_form'
  FROM (VALUES
    ('decisao_real',        'decidi_estruturar'),
    ('urgencia_real',       'alta'),
    ('conflito_real',       'concordamos_em_tudo_(amigável)'),
    ('valor_bens_real',     '500k_1m'),
    ('filhos_menores_real', 'sim'),
    ('estagio',             'ainda_não_comecei_nada')
  ) AS q(key, val)
  WHERE NOT EXISTS (
    SELECT 1 FROM lead_answers
    WHERE lead_id = v_lead_id AND question_key = q.key AND source = 'meta_form'
  );

  -- Recalcula score
  PERFORM public.calculate_lead_score(v_lead_id);
  RAISE NOTICE 'Luciano Silva: respostas inseridas e score recalculado.';
END;
$$;
