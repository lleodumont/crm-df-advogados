ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE leads REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
