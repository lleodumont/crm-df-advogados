/*
  Fix: adicionar UNIQUE constraint em whatsapp_messages.external_id

  Sem esse constraint, o upsert com onConflict: "external_id" falha silenciosamente
  (PostgreSQL exige unique constraint ou unique index para ON CONFLICT funcionar).

  Usa índice parcial (WHERE external_id IS NOT NULL) para permitir múltiplos NULLs.
  Remove duplicatas antes de criar o índice.
*/

-- Remover duplicatas mantendo a linha mais antiga (menor created_at)
DELETE FROM whatsapp_messages
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY created_at ASC) AS rn
    FROM whatsapp_messages
    WHERE external_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Criar índice único parcial (NULLs são ignorados = múltiplos NULLs permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_external_id_unique
  ON whatsapp_messages(external_id)
  WHERE external_id IS NOT NULL;
