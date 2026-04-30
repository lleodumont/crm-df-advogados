-- Migration: adiciona colunas para credenciais Meta Cloud API em whatsapp_instances
-- A UazAPI é mantida como fallback durante a transição (colunas api_url e token ficam)

ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS phone_number_id text,
  ADD COLUMN IF NOT EXISTS access_token    text,
  ADD COLUMN IF NOT EXISTS waba_id         text;

COMMENT ON COLUMN whatsapp_instances.phone_number_id IS 'Meta Cloud API: Phone Number ID do Meta Business Manager';
COMMENT ON COLUMN whatsapp_instances.access_token    IS 'Meta Cloud API: Token de acesso longo';
COMMENT ON COLUMN whatsapp_instances.waba_id         IS 'Meta Cloud API: WhatsApp Business Account ID (para templates)';
COMMENT ON COLUMN whatsapp_instances.api_url         IS 'Deprecado — UazAPI apenas. Usar phone_number_id + access_token';
COMMENT ON COLUMN whatsapp_instances.token           IS 'Deprecado — UazAPI apenas. Usar access_token';
