/*
  # Auto-assign leads to Rhuam + Admin activity scheduling

  1. Trigger: novos leads sem responsável são automaticamente atribuídos ao Rhuam
  2. RLS: admins podem criar/editar atividades para qualquer usuário
*/

-- ============================================================
-- TRIGGER: Auto-assign lead to Rhuam when owner_user_id is null
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_rhuam()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rhuam_id uuid;
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    SELECT id INTO rhuam_id
    FROM public.user_profiles
    WHERE email = 'rhuamcarlostr@gmail.com'
    LIMIT 1;

    IF rhuam_id IS NOT NULL THEN
      NEW.owner_user_id := rhuam_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_lead ON leads;

CREATE TRIGGER trg_auto_assign_lead
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_lead_to_rhuam();

-- ============================================================
-- RLS: Admins can create/update activities for any user
-- ============================================================

-- DROP existing restrictive policies
DROP POLICY IF EXISTS "Users can create scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can update their own scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can delete their own scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can view their own scheduled activities" ON scheduled_activities;
DROP POLICY IF EXISTS "Users can view scheduled activities for leads they own" ON scheduled_activities;

-- SELECT: own + leads they own + admins see all
CREATE POLICY "select_scheduled_activities"
  ON scheduled_activities FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = scheduled_activities.lead_id
        AND leads.owner_user_id = auth.uid()
    )
    OR current_user_role() = 'admin'
  );

-- INSERT: own activities OR admin assigning to anyone
CREATE POLICY "insert_scheduled_activities"
  ON scheduled_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR current_user_role() = 'admin'
  );

-- UPDATE: own activities OR admin updating any
CREATE POLICY "update_scheduled_activities"
  ON scheduled_activities FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR current_user_role() = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR current_user_role() = 'admin'
  );

-- DELETE: own activities OR admin deleting any
CREATE POLICY "delete_scheduled_activities"
  ON scheduled_activities FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR current_user_role() = 'admin'
  );
