/*
  # Webhook: notifica grupo WhatsApp ao inserir novo lead

  Usa pg_net (disponível no Supabase) para chamar a Edge Function
  notify-new-lead sempre que um lead for inserido na tabela leads.
*/

-- Habilita extensão pg_net se ainda não estiver ativa
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função que dispara a chamada HTTP para a Edge Function
CREATE OR REPLACE FUNCTION public.notify_new_lead_to_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text := 'https://gknevfldmvtnjluotdmf.supabase.co';
  service_key  text := current_setting('app.supabase_service_role_key', true);
BEGIN
  PERFORM extensions.http_post(
    url     := supabase_url || '/functions/v1/notify-new-lead',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey',        service_key
    ),
    body    := to_jsonb(NEW)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia a inserção do lead por falha na notificação
  RAISE WARNING 'notify_new_lead_to_whatsapp falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_lead ON leads;

CREATE TRIGGER trg_notify_new_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_lead_to_whatsapp();
