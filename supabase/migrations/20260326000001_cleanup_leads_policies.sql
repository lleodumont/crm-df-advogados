/*
  # Cleanup leads policies — remove all existing, keep only sector-based ones

  Drops ALL policies on leads/activities/meetings/proposals regardless of name,
  then recreates the correct sector-based ones. This handles cases where policies
  were created with different names than expected.
*/

-- Drop all policies on leads table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON leads', pol.policyname);
  END LOOP;
END;
$$;

-- Drop all policies on activities table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'activities' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON activities', pol.policyname);
  END LOOP;
END;
$$;

-- Drop all policies on lead_answers table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'lead_answers' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON lead_answers', pol.policyname);
  END LOOP;
END;
$$;

-- Drop all policies on meetings table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'meetings' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON meetings', pol.policyname);
  END LOOP;
END;
$$;

-- Drop all policies on proposals table
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'proposals' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON proposals', pol.policyname);
  END LOOP;
END;
$$;

-- Recreate leads policies
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
      AND (leads.owner_user_id = auth.uid() OR leads.owner_user_id IS NULL)
      AND get_lead_sector(leads.status) = 'comercial'
    )
  );

CREATE POLICY "Atendimento and above can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial'))
  );

CREATE POLICY "Users can update leads they own"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    leads.owner_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial'))
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Recreate activities policies
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
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial') AND get_lead_sector(leads.status) = 'comercial')
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'juridico' AND get_lead_sector(leads.status) = 'juridico')
      )
    )
  );

CREATE POLICY "Atendimento and above can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial', 'juridico'))
  );

-- Recreate lead_answers policies
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
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial'))
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'juridico' AND get_lead_sector(leads.status) = 'juridico')
      )
    )
  );

CREATE POLICY "Atendimento and above can create answers"
  ON lead_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial'))
  );

-- Recreate meetings policies
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
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial'))
        OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'juridico' AND get_lead_sector(leads.status) = 'juridico')
      )
    )
  );

CREATE POLICY "Atendimento and above can manage meetings"
  ON meetings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'atendimento', 'comercial'))
  );

-- Recreate proposals policies
CREATE POLICY "Comercial and admin can view all proposals"
  ON proposals FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial'))
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN leads l ON l.id = proposals.lead_id
      WHERE up.id = auth.uid() AND up.role = 'juridico'
      AND get_lead_sector(l.status) = 'juridico'
    )
  );

CREATE POLICY "Comercial and admin can manage proposals"
  ON proposals FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial'))
  );
