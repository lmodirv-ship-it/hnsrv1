// Engine 1/5: Request Analyzer
// Understands what the user wants: language, canonical intent, entities,
// and a short summary. Falls back to a rule-based classifier if the AI
// Gateway is unavailable.

import type { AnalyzerResult } from "./types";
import { chatJSON } from "./lovable-ai.server";

const CANONICAL_INTENTS = [
  "build_website",
  "generate_logo",
  "generate_images",
  "generate_texts",
  "setup_database",
  "deploy_site",
  "chat",
  "video",
  "single_task",
  "unknown",
] as const;

const AR_ARABIC_RE = /[\u0600-\u06FF]/;

function detectLanguage(prompt: string): string {
  return AR_ARABIC_RE.test(prompt) ? "ar" : "en";
}

function ruleBasedAnalyze(prompt: string): AnalyzerResult {
  const lower = prompt.toLowerCase();
  const language = detectLanguage(prompt);

  const has = (words: string[]) => words.some((w) => lower.includes(w));

  let intent: string = "single_task";
  let domain: string | undefined;

  if (has(["website", "site", "landing", "موقع", "متجر"])) intent = "build_website";
  else if (has(["logo", "شعار"])) intent = "generate_logo";
  else if (has(["image", "picture", "photo", "صور", "صورة"])) intent = "generate_images";
  else if (has(["deploy", "publish", "نشر", "استضافة"])) intent = "deploy_site";
  else if (has(["database", "db", "قاعدة"])) intent = "setup_database";
  else if (has(["video", "فيديو"])) intent = "video";

  const domains: Array<[string, string[]]> = [
    ["restaurant", ["restaurant", "مطعم", "cafe", "مقهى"]],
    ["ecommerce", ["shop", "store", "متجر", "ecommerce"]],
    ["blog", ["blog", "مدونة"]],
    ["portfolio", ["portfolio", "معرض"]],
    ["clinic", ["clinic", "عيادة"]],
  ];
  for (const [d, kws] of domains) if (has(kws)) { domain = d; break; }

  return {
    language,
    intent,
    entities: domain ? { domain } : {},
    domain,
    summary: prompt.slice(0, 240),
  };
}

export async function analyzeRequest(prompt: string): Promise<AnalyzerResult> {
  const ai = await chatJSON<AnalyzerResult>({
    system:
      "You are the Request Analyzer for HN Service Hub. Extract the canonical intent, language, entities, and a one-line summary from a user request. " +
      "intent must be one of: " + CANONICAL_INTENTS.join(", ") + ". " +
      "language is a 2-letter code (ar, en, ...). Extract meaningful entities like domain (restaurant, ecommerce...), brand_name, style, count.",
    user: prompt,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        language: { type: "string" },
        intent: { type: "string", enum: [...CANONICAL_INTENTS] },
        entities: { type: "object", additionalProperties: true },
        domain: { type: "string" },
        summary: { type: "string" },
      },
      required: ["language", "intent", "entities", "summary"],
    },
    timeoutMs: 12_000,
  });

  if (ai.ok && ai.data && typeof ai.data === "object") {
    const d = ai.data as AnalyzerResult;
    return {
      language: d.language || detectLanguage(prompt),
      intent: d.intent || "unknown",
      entities: d.entities ?? {},
      domain: d.domain,
      summary: d.summary || prompt.slice(0, 240),
    };
  }
  return ruleBasedAnalyze(prompt);
}
