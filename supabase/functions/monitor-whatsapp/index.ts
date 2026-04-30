import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey",
};

const VALID_QUERIES = ["no_response", "hot_leads", "audio_chats", "pending_meetings", "proposals_sent"] as const;
type QueryType = typeof VALID_QUERIES[number];

const RPC_MAP: Record<QueryType, string> = {
  no_response:      "monitor_no_response",
  hot_leads:        "monitor_hot_leads",
  audio_chats:      "monitor_audio_chats",
  pending_meetings: "monitor_pending_meetings",
  proposals_sent:   "monitor_proposals_sent",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const body = await req.json().catch(() => ({}));
    const query: QueryType | undefined = body.query;

    // Sem parâmetro: retorna resumo de todos
    if (!query) {
      const results: Record<string, unknown> = {};
      for (const q of VALID_QUERIES) {
        const r = await callRpc(supabaseUrl, serviceKey, RPC_MAP[q]);
        results[q] = { count: r.length, rows: r };
      }
      return json({ results });
    }

    if (!VALID_QUERIES.includes(query)) {
      return json({ error: "query inválida", valid: VALID_QUERIES }, 400);
    }

    const rows = await callRpc(supabaseUrl, serviceKey, RPC_MAP[query]);
    return json({ query, count: rows.length, rows });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

async function callRpc(supabaseUrl: string, serviceKey: string, rpc: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RPC ${rpc} falhou: ${err}`);
  }
  return res.json();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
