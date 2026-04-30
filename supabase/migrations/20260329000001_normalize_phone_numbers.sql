-- Remove + do início dos telefones em leads
UPDATE leads
SET phone = regexp_replace(phone, '^\+', '')
WHERE phone LIKE '+%';

-- Remove + do início dos telefones em whatsapp_messages
UPDATE whatsapp_messages
SET phone_number = regexp_replace(phone_number, '^\+', '')
WHERE phone_number LIKE '+%';
