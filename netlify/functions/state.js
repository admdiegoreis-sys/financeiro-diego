const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STATE_TABLE = process.env.SUPABASE_STATE_TABLE || "financeiro_diego_app_state";
const APP_STATE_ID = process.env.APP_STATE_ID || "financeiro-diego-prod";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return response(500, {
      error: "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Netlify.",
    });
  }

  try {
    if (event.httpMethod === "GET") {
      return await readState();
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      return await writeState(body.data || {});
    }

    return response(405, { error: "Metodo nao permitido." });
  } catch (error) {
    return response(500, { error: error.message || "Erro inesperado." });
  }
};

async function readState() {
  const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?id=eq.${encodeURIComponent(APP_STATE_ID)}&select=data`;
  const result = await supabaseFetch(url, { method: "GET" });
  return response(200, { data: result?.[0]?.data || {} });
}

async function writeState(data) {
  const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?on_conflict=id`;
  await supabaseFetch(url, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: APP_STATE_ID,
      data,
      updated_at: new Date().toISOString(),
    }),
  });
  return response(200, { ok: true });
}

async function supabaseFetch(url, options) {
  const result = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!result.ok) {
    const text = await result.text();
    throw new Error(`Supabase ${result.status}: ${text}`);
  }

  if (result.status === 204) return null;
  const text = await result.text();
  return text ? JSON.parse(text) : null;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}
