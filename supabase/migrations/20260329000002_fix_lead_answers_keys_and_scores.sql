-- 1. Corrige question_keys incorretos (decisao→decisao_real, urgencia→urgencia_real, bens→valor_bens_real)
UPDATE lead_answers SET question_key = 'decisao_real'    WHERE question_key = 'decisao';
UPDATE lead_answers SET question_key = 'urgencia_real'   WHERE question_key = 'urgencia';
UPDATE lead_answers SET question_key = 'valor_bens_real' WHERE question_key = 'bens';

-- 2. Normaliza valores do formulário Meta para tokens de scoring

-- decisao_real
UPDATE lead_answers SET answer_value = 'decidi_estruturar'
  WHERE question_key = 'decisao_real'
    AND lower(answer_value) LIKE '%já_estou_decidido%';

UPDATE lead_answers SET answer_value = 'quase_decidido'
  WHERE question_key = 'decisao_real'
    AND lower(answer_value) LIKE '%inclinado%';

UPDATE lead_answers SET answer_value = 'avaliando'
  WHERE question_key = 'decisao_real'
    AND lower(answer_value) LIKE '%ainda_estou_pensando%';

-- urgencia_real
UPDATE lead_answers SET answer_value = 'alta'
  WHERE question_key = 'urgencia_real'
    AND lower(answer_value) LIKE '%imediatamente%';

UPDATE lead_answers SET answer_value = 'media'
  WHERE question_key = 'urgencia_real'
    AND lower(answer_value) LIKE '%próximos_meses%';

UPDATE lead_answers SET answer_value = 'baixa'
  WHERE question_key = 'urgencia_real'
    AND lower(answer_value) LIKE '%buscando_informações%';

-- valor_bens_real
UPDATE lead_answers SET answer_value = 'acima_1m'
  WHERE question_key = 'valor_bens_real'
    AND lower(answer_value) LIKE '%1_milh%';

UPDATE lead_answers SET answer_value = '500k_1m'
  WHERE question_key = 'valor_bens_real'
    AND lower(answer_value) LIKE '%500_mil_e_r$_1%';

UPDATE lead_answers SET answer_value = '100k_500k'
  WHERE question_key = 'valor_bens_real'
    AND lower(answer_value) LIKE '%100_mil%e%500%';

UPDATE lead_answers SET answer_value = '200k_500k'
  WHERE question_key = 'valor_bens_real'
    AND lower(answer_value) LIKE '%200_mil%e%500%';

UPDATE lead_answers SET answer_value = 'ate_200k'
  WHERE question_key = 'valor_bens_real'
    AND (lower(answer_value) LIKE '%menos_de%' OR lower(answer_value) LIKE '%não_há_bens%' OR lower(answer_value) LIKE '%nao_ha_bens%');

-- 3. Recalcula score de todos os leads que têm respostas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT lead_id FROM lead_answers
  LOOP
    PERFORM public.calculate_lead_score(r.lead_id);
  END LOOP;
END;
$$;
