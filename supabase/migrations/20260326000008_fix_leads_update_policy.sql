/*
  Fix: permitir que qualquer usuário autenticado atribua responsável a leads sem dono.

  Antes: só admin/comercial ou o próprio dono podiam atualizar o lead.
  Resultado: atendimento não conseguia se atribuir a leads novos (owner_user_id = null).

  Agora: atendimento também pode atualizar leads sem dono (para se atribuir)
  e leads que já são deles.
*/

DROP POLICY IF EXISTS "Users can update leads they own" ON leads;

CREATE POLICY "Users can update leads they own"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    leads.owner_user_id IS NULL
    OR leads.owner_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'comercial'))
  );
