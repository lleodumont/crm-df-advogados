-- Automation Flows: fluxos automáticos de envio de templates WhatsApp

-- Tabela de fluxos (ex: "Novo lead do Meta")
CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('new_lead')),
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Passos de cada fluxo
CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'pt_BR',
  template_components JSONB DEFAULT '[]'::jsonb,
  message_body TEXT,              -- Texto do template para exibir no chat
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Execuções agendadas por lead
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES automation_steps(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para o runner buscar execuções pendentes rapidamente
CREATE INDEX idx_automation_executions_pending
  ON automation_executions (scheduled_at)
  WHERE status = 'pending';

-- Índice para cancelar execuções de um lead específico
CREATE INDEX idx_automation_executions_lead
  ON automation_executions (lead_id, status);

-- RLS
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Flows: todos autenticados veem; apenas admin/manager criam/editam/deletam
CREATE POLICY "automation_flows_select" ON automation_flows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "automation_flows_insert" ON automation_flows
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "automation_flows_update" ON automation_flows
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "automation_flows_delete" ON automation_flows
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Steps: mesmo padrão
CREATE POLICY "automation_steps_select" ON automation_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "automation_steps_insert" ON automation_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "automation_steps_update" ON automation_steps
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "automation_steps_delete" ON automation_steps
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Executions: todos autenticados veem
CREATE POLICY "automation_executions_select" ON automation_executions
  FOR SELECT TO authenticated USING (true);

-- Trigger para updated_at em automation_flows
CREATE OR REPLACE FUNCTION update_automation_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_flows_updated_at
  BEFORE UPDATE ON automation_flows
  FOR EACH ROW EXECUTE FUNCTION update_automation_flows_updated_at();

-- ----------------------------------------------------------------
-- pg_cron: agendar o automation-runner a cada minuto
-- Execute manualmente após o deploy da Edge Function automation-runner:
--
-- SELECT cron.schedule(
--   'automation-runner',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://asnenjgwavrdmwjrbzec.supabase.co/functions/v1/automation-runner',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );
-- ----------------------------------------------------------------
