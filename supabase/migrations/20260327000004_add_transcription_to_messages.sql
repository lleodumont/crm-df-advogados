-- Adiciona coluna para armazenar transcrição de áudios
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS transcription text;
