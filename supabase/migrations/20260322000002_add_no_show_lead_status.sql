-- Adiciona 'no_show' ao check constraint do campo status de leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('novo', 'triagem', 'qualificado', 'agendado', 'compareceu', 'no_show', 'proposta_enviada', 'ganho', 'perdido', 'maturacao'));

-- Reordena estágios existentes para abrir espaço no índice 5 (no_show entra após compareceu=4)
UPDATE pipeline_stages SET order_index = 9 WHERE stage_key = 'lost';
UPDATE pipeline_stages SET order_index = 8 WHERE stage_key = 'won';
UPDATE pipeline_stages SET order_index = 7 WHERE stage_key = 'negotiation';
UPDATE pipeline_stages SET order_index = 6 WHERE stage_key = 'proposal_sent';

-- Insere estágio Não Compareceu na posição 5
INSERT INTO pipeline_stages (name, stage_key, color, order_index, is_default)
VALUES ('Não Compareceu', 'no_show', '#F97316', 5, true)
ON CONFLICT (stage_key) DO UPDATE SET
  name = 'Não Compareceu',
  color = '#F97316',
  order_index = 5,
  is_default = true;
