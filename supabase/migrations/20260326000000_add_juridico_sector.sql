/*
  # Add sector division (Comercial / Jurídico)

  1. Adds `sector` column to pipeline_stages ('comercial' | 'juridico')
  2. Adds 'juridico' to user_profiles role CHECK constraint
  3. Creates helper function get_lead_sector(status) → sector
  4. Updates RLS policies on leads, activities, lead_answers, meetings, proposals
  5. Updates get_whatsapp_conversations() to accept optional sector filter
*/

-- 1. Add sector column to pipeline_stages
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'comercial'
  CHECK (sector IN ('comercial', 'juridico'));

-- Mark 'won' stage as juridico
UPDATE pipeline_stages SET sector = 'juridico' WHERE stage_key = 'won';

-- 2. Add 'juridico' to user_profiles role constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'atendimento', 'comercial', 'juridico', 'viewer'));

-- 3. Helper function: maps leads.status → pipeline_stages.stage_key → sector
CREATE OR REPLACE FUNCTION get_lead_sector(p_status text)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (
      SELECT ps.sector
      FROM pipeline_stages ps
      WHERE ps.stage_key = CASE p_status
        WHEN 'novo'             THEN 'new'
        WHEN 'triagem'          THEN 'new'
        WHEN 'qualificado'      THEN 'qualified'
        WHEN 'agendado'         THEN 'meeting_scheduled'
        WHEN 'compareceu'       THEN 'meeting_held'
        WHEN 'no_show'          THEN 'meeting_held'
        WHEN 'proposta_enviada' THEN 'proposal_sent'
        WHEN 'ganho'            THEN 'won'
        WHEN 'perdido'          THEN 'lost'
        WHEN 'maturacao'        THEN 'negotiation'
        ELSE p_status
      END
      LIMIT 1
    ),
    'comercial'
  )
$$;

-- 4. Drop and recreate leads SELECT policy
DROP POLICY IF EXISTS "Users can view leads they own or unassigned" ON leads;

CREATE POLICY "Users can view leads by sector"
  ON leads FOR SELECT
  TO authenticated
  USING (
    -- Admin sees all
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Comercial sees comercial sector
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'comercial'
      )
      AND get_lead_sector(leads.status) = 'comercial'
    )
    OR
    -- Juridico sees juridico sector
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'juridico'
      )
      AND get_lead_sector(leads.status) = 'juridico'
    )
    OR
    -- Atendimento/viewer see own leads or unassigned in comercial sector
    (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role IN ('atendimento', 'viewer')
      )
      AND (leads.owner_user_id = auth.uid() OR leads.owner_user_id IS NULL)
      AND get_lead_sector(leads.status) = 'comercial'
    )
  );

-- 5. Leads INSERT policy (juridico cannot create leads)
DROP POLICY IF EXISTS "Atendimento and above can create leads" ON leads;

CREATE POLICY "Atendimento and above can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial')
    )
  );

-- 6. Leads UPDATE policy (juridico cannot edit leads)
DROP POLICY IF EXISTS "Users can update leads they own" ON leads;

CREATE POLICY "Users can update leads they own"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    leads.owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
  );

-- 7. Activities SELECT policy — include juridico
DROP POLICY IF EXISTS "Users can view activities for accessible leads" ON activities;

CREATE POLICY "Users can view activities for accessible leads"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = activities.lead_id
      AND (
        leads.owner_user_id = auth.uid()
        OR leads.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'comercial')
          AND get_lead_sector(leads.status) = 'comercial'
        )
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role = 'juridico'
          AND get_lead_sector(leads.status) = 'juridico'
        )
      )
    )
  );

-- 8. Activities INSERT policy — include juridico
DROP POLICY IF EXISTS "Atendimento and above can create activities" ON activities;

CREATE POLICY "Atendimento and above can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial', 'juridico')
    )
  );

-- 9. lead_answers SELECT — include juridico
DROP POLICY IF EXISTS "Users can view answers for accessible leads" ON lead_answers;

CREATE POLICY "Users can view answers for accessible leads"
  ON lead_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_answers.lead_id
      AND (
        leads.owner_user_id = auth.uid()
        OR leads.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'comercial')
        )
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role = 'juridico'
          AND get_lead_sector(leads.status) = 'juridico'
        )
      )
    )
  );

-- 10. meetings SELECT — include juridico
DROP POLICY IF EXISTS "Users can view meetings for accessible leads" ON meetings;

CREATE POLICY "Users can view meetings for accessible leads"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = meetings.lead_id
      AND (
        leads.owner_user_id = auth.uid()
        OR leads.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role IN ('admin', 'comercial')
        )
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND role = 'juridico'
          AND get_lead_sector(leads.status) = 'juridico'
        )
      )
    )
  );

-- 11. proposals SELECT — include juridico
DROP POLICY IF EXISTS "Comercial and admin can view all proposals" ON proposals;

CREATE POLICY "Comercial and admin can view all proposals"
  ON proposals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'comercial')
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN leads l ON l.id = proposals.lead_id
      WHERE up.id = auth.uid() AND up.role = 'juridico'
      AND get_lead_sector(l.status) = 'juridico'
    )
  );

-- 12. Update get_whatsapp_conversations to accept optional sector filter
-- SECURITY DEFINER bypasses RLS, so we filter manually by sector
CREATE OR REPLACE FUNCTION get_whatsapp_conversations(p_sector text DEFAULT NULL)
RETURNS TABLE (
  lead_id uuid,
  lead_name text,
  lead_phone text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint,
  last_message_direction text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS lead_id,
    l.full_name AS lead_name,
    l.phone AS lead_phone,
    (
      SELECT content
      FROM whatsapp_messages wm2
      WHERE wm2.lead_id = l.id
      ORDER BY wm2.created_at DESC
      LIMIT 1
    ) AS last_message,
    (
      SELECT created_at
      FROM whatsapp_messages wm2
      WHERE wm2.lead_id = l.id
      ORDER BY wm2.created_at DESC
      LIMIT 1
    ) AS last_message_time,
    (
      SELECT COUNT(*)
      FROM whatsapp_messages wm2
      WHERE wm2.lead_id = l.id
        AND wm2.direction = 'inbound'
        AND wm2.status != 'read'
    ) AS unread_count,
    (
      SELECT direction::text
      FROM whatsapp_messages wm2
      WHERE wm2.lead_id = l.id
      ORDER BY wm2.created_at DESC
      LIMIT 1
    ) AS last_message_direction
  FROM leads l
  WHERE EXISTS (
    SELECT 1
    FROM whatsapp_messages wm
    WHERE wm.lead_id = l.id
  )
  AND (p_sector IS NULL OR get_lead_sector(l.status) = p_sector)
  ORDER BY last_message_time DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Index for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_sector ON pipeline_stages(sector);
