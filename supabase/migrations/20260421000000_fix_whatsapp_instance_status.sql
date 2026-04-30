-- Fix: instâncias com phone_number_id preenchido devem ter status 'connected'
-- O botão "Verificar" estava sobrescrevendo status para 'disconnected' em falhas de token
UPDATE whatsapp_instances
SET status = 'connected'
WHERE phone_number_id IS NOT NULL
  AND status = 'disconnected';
