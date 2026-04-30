/*
  Substituir índice PARCIAL por constraint UNIQUE completa em external_id.

  O índice parcial (WHERE external_id IS NOT NULL) não é reconhecido pelo
  Supabase JS ao gerar ON CONFLICT (external_id) — ele precisa de um constraint
  sem cláusula WHERE para funcionar.

  PostgreSQL permite múltiplos NULLs mesmo em unique constraints, então não há
  problema em deixar external_id nullable com unique constraint.
*/

-- Remover índice parcial criado antes
DROP INDEX IF EXISTS idx_whatsapp_messages_external_id_unique;

-- Criar constraint UNIQUE completa (sem WHERE)
ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_external_id_unique UNIQUE (external_id);
