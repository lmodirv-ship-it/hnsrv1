// Thin wrapper around Lovable AI Gateway for JSON-structured completions.
// SERVER ONLY.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export async function chatJSON<T = unknown>(opts: {
  system: string;
  user: string;
  schema?: Record<string, unknown>;
  model?: string;
  timeoutMs?: number;
}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, error: "LOVABLE_API_KEY missing" };

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };

  if (opts.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "response", strict: true, schema: opts.schema },
    };
  } else {
    body.response_format = { type: "json_object" };
  }

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `AI Gateway ${res.status}: ${text.slice(0, 500)}` };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json?.choices?.[0]?.message?.content ?? "";
    try {
      return { ok: true, data: JSON.parse(content) as T };
    } catch {
      // Salvage first {...} block
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return { ok: true, data: JSON.parse(m[0]) as T };
        } catch {
          /* fall through */
        }
      }
      return { ok: false, error: "AI response was not valid JSON" };
    }
  } catch (e: any) {
    const abort = e?.name === "AbortError";
    return { ok: false, error: abort ? "AI Gateway timeout" : String(e?.message ?? e) };
  } finally {
    clearTimeout(to);
  }
}
