-- Permite que usuários autenticados façam upload no bucket whatsapp-media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política: usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Política: leitura pública (bucket já é público, mas garante via RLS também)
CREATE POLICY "Public read access for media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

-- Política: usuários autenticados podem deletar seus próprios uploads
CREATE POLICY "Authenticated users can delete media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');
