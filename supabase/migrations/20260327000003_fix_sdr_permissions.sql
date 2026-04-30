/*
  Fix: SDR (atendimento) deve ver e editar todos os leads do setor comercial,
  não apenas os próprios ou sem dono.
*/

-- 1. Atualiza SELECT: atendimento vê todos os leads do setor comercial
DROP POLICY IF EXISTS "Users can view leads by sector" ON leads;

CREATE POLICY "Users can view leads by sector"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'comercial')
      AND get_lead_sector(leads.status) = 'comercial'
    )
    OR (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'juridico')
      AND get_lead_sector(leads.status) = 'juridico'
    )
    OR (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('atendimento', 'viewer'))
      AND get_lead_sector(leads.status) = 'comercial'
    )
  );

-- 2. Atualiza UPDATE: atendimento pode editar qualquer lead do setor comercial
DROP POLICY IF EXISTS "Users can update leads they own" ON leads;

CREATE POLICY "Users can update leads they own"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial', 'atendimento'))
    OR leads.owner_user_id = auth.uid()
  );
