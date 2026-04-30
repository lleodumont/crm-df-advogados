-- Remove o CHECK constraint fixo de leads.status para permitir stage_keys customizados.
-- Os valores válidos agora são gerenciados pela tabela pipeline_stages.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
