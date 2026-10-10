/** CORS for the app origin only (APP_ORIGIN). Falls back to "*" for local development. */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...extra },
  });
}
