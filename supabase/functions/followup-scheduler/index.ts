import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const defaultPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
    const defaultAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

    // Buscar leads qualificados sem contato nos últimos 3 dias
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleLeads, error } = await supabase
      .from('leads')
      .select('id, full_name, phone, classification, score_total')
      .in('status', ['qualificado', 'agendado', 'triagem'])
      .in('classification', ['qualificado', 'estrategico'])
      .or(`last_whatsapp_response_at.lt.${threeDaysAgo},last_whatsapp_response_at.is.null`)
      .order('score_total', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Buscar instância conectada (prefere instância com credenciais Meta próprias)
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, phone_number_id, access_token')
      .eq('status', 'connected')
      .limit(1)
      .single();

    if (!instance || !staleLeads?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhuma ação necessária',
        leadsProcessed: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;
    const errors: string[] = [];

    for (const lead of staleLeads) {
      try {
        const message = lead.classification === 'estrategico'
          ? `Olá ${lead.full_name.split(' ')[0]}! 👋 Passando para ver se posso te ajudar com alguma dúvida sobre seu processo. Estou à disposição!`
          : `Olá ${lead.full_name.split(' ')[0]}! Como posso te ajudar hoje? 😊`;

        // Enviar via Meta Cloud API
        const phoneNumberId = instance.phone_number_id || defaultPhoneNumberId;
        const accessToken = instance.access_token || defaultAccessToken;
        const cleanPhone = lead.phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

        const sendRes = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: formattedPhone,
              type: 'text',
              text: { body: message },
            }),
          }
        );

        if (!sendRes.ok) {
          errors.push(`Lead ${lead.id}: ${sendRes.statusText}`);
          continue;
        }

        // Registrar atividade
        await supabase.from('activities').insert({
          lead_id: lead.id,
          type: 'msg_sent',
          channel: 'whatsapp',
          content: `[Follow-up automático] ${message}`,
        });

        processed++;
        // Delay entre mensagens para respeitar rate limit
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        errors.push(`Lead ${lead.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      leadsProcessed: processed,
      errors: errors.length > 0 ? errors : undefined
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
