-- supabase/migrations/20260421000001_ai_agent_tables.sql

-- Estado de cada conversa ativa com o agente
CREATE TABLE IF NOT EXISTS ai_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  phone text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'handoff', 'nutricao', 'encerrado')),
  classificacao text
    CHECK (classificacao IN ('estrategico', 'qualificado', 'morno', null)),
  tipo_demanda text
    CHECK (tipo_demanda IN ('divorcio', 'outro', null)),
  dados_coletados jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumo text,
  turno int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- System prompt e configurações do agente (editável sem deploy)
CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system_prompt text NOT NULL,
  modelo text NOT NULL DEFAULT 'claude-sonnet-4-6',
  max_turnos int NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Credenciais UAZAPI para envio ao grupo do SDR
CREATE TABLE IF NOT EXISTS uazapi_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  api_key text NOT NULL,
  sdr_group_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_conversation_state_updated_at
  BEFORE UPDATE ON ai_conversation_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ai_agent_configs_updated_at
  BEFORE UPDATE ON ai_agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: somente service role acessa (agente roda server-side)
ALTER TABLE ai_conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE uazapi_instances ENABLE ROW LEVEL SECURITY;

-- Permite acesso total via service role (Edge Functions)
CREATE POLICY "service_role_all" ON ai_conversation_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON ai_agent_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON uazapi_instances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Permite leitura autenticada (para UI do CRM)
CREATE POLICY "authenticated_read" ON uazapi_instances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_all" ON uazapi_instances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_configs" ON ai_agent_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_configs" ON ai_agent_configs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
