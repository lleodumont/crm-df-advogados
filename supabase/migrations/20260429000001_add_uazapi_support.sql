-- Adiciona suporte a múltiplos provedores WhatsApp em whatsapp_instances
-- provider: 'meta' (padrão) | 'uazapi'
-- uazapi_token: token de autenticação UazAPI (enviado no header "token")
-- api_url já existe desde 20260302041947 — não recriar

ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'meta'
    CHECK (provider IN ('meta', 'uazapi')),
  ADD COLUMN IF NOT EXISTS uazapi_token text;

-- Instâncias existentes com phone_number_id preenchido são Meta
UPDATE whatsapp_instances
  SET provider = 'meta'
  WHERE phone_number_id IS NOT NULL;

COMMENT ON COLUMN whatsapp_instances.provider     IS 'Provedor da API: meta | uazapi';
COMMENT ON COLUMN whatsapp_instances.uazapi_token IS 'UazAPI: token de autenticação (header "token")';
COMMENT ON COLUMN whatsapp_instances.api_url      IS 'UazAPI: URL base da instância (ex: https://api.uazapi.com)';
