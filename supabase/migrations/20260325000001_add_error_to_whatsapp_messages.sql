-- Add error column to whatsapp_messages for tracking send and media failures
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error text;
