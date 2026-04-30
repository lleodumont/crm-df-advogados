-- Enable Realtime for whatsapp_messages so the chat UI updates in real time
ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
