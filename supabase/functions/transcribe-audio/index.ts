import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, messageId } = await req.json();

    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "audioUrl é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Baixa o áudio da URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível baixar o áudio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBlob = await audioResponse.blob();
    const contentType = audioResponse.headers.get("content-type") || "audio/ogg";

    // Detecta extensão pelo content-type
    const extMap: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "mp4",
      "audio/wav": "wav",
      "audio/webm": "webm",
      "audio/aac": "aac",
      "audio/opus": "opus",
    };
    const ext = extMap[contentType.split(";")[0].trim()] || "ogg";
    const filename = `audio.${ext}`;

    // Envia para OpenAI Whisper
    const formData = new FormData();
    formData.append("file", new File([audioBlob], filename, { type: contentType }));
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      return new Response(JSON.stringify({ error: `Whisper error: ${err}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await whisperRes.json();

    // Salva a transcrição na mensagem (se messageId fornecido)
    if (messageId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(`${supabaseUrl}/rest/v1/whatsapp_messages?id=eq.${messageId}`, {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ transcription: text }),
      });
    }

    return new Response(JSON.stringify({ transcription: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
