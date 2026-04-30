-- Unique constraint para evitar leads duplicados pelo telefone
-- Primeiro remove duplicatas mantendo o mais antigo
DELETE FROM leads a
USING leads b
WHERE a.created_at > b.created_at
  AND a.phone = b.phone
  AND a.phone IS NOT NULL
  AND a.phone != '';

-- Cria o unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique ON leads (phone)
  WHERE phone IS NOT NULL AND phone != '';
