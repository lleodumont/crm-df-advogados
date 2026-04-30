/*
  Fix: whatsapp_instances RLS policies referenced role 'manager' which does not exist.
  Valid roles are: admin, atendimento, comercial, viewer.
  Replace INSERT/UPDATE policies to only allow 'admin'.
*/

-- Drop the incorrectly-scoped policies
DROP POLICY IF EXISTS "Admins and managers can create WhatsApp instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins and managers can update WhatsApp instances" ON whatsapp_instances;

-- Recreate with correct roles (admin only for instance management)
CREATE POLICY "Admins can create WhatsApp instances"
  ON whatsapp_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update WhatsApp instances"
  ON whatsapp_instances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
