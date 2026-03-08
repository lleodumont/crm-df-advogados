/*
  # Permitir que admins excluam qualquer etapa do pipeline

  1. Alterações
    - Remove a política antiga de DELETE que restringia exclusão apenas a etapas não-padrão
    - Adiciona nova política que permite admins excluírem qualquer etapa (incluindo padrões)
  
  2. Segurança
    - Apenas usuários com role 'admin' podem excluir etapas
    - Remove a restrição `is_default = false`
*/

-- Remove a política antiga que só permitia excluir etapas não-padrão
DROP POLICY IF EXISTS "Admins can delete non-default pipeline stages" ON pipeline_stages;

-- Cria nova política que permite admins excluírem qualquer etapa
CREATE POLICY "Admins can delete all pipeline stages"
  ON pipeline_stages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );
