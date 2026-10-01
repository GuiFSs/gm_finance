import { asc } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { getPocketBalances } from "@/shared/lib/finance-service";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
/** ~4 MB de base64 — gravações curtas de despesa. */
const MAX_AUDIO_BASE64_CHARS = 4_000_000;

export type NamedId = { id: string; name: string };

export type PurchaseParseContext = {
  todayYmd: string;
  pockets: NamedId[];
  cards: NamedId[];
  categories: NamedId[];
  tags: NamedId[];
};

export const parseVoiceRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(2000).optional(),
  audioBase64: z.string().min(1).max(MAX_AUDIO_BASE64_CHARS).optional(),
  mimeType: z.string().trim().min(1).max(100).optional(),
}).superRefine((val, ctx) => {
  const hasText = Boolean(val.transcript?.trim());
  const hasAudio = Boolean(val.audioBase64?.trim());
  if (!hasText && !hasAudio) {
    ctx.addIssue({ code: "custom", message: "Informe transcript ou audioBase64" });
  }
  if (hasAudio && !val.mimeType?.trim()) {
    ctx.addIssue({ code: "custom", path: ["mimeType"], message: "mimeType é obrigatório com áudio" });
  }
});

/** Resposta do Gemini (antes de sanitizar IDs). */
export const geminiPurchaseDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  amount: z
    .union([z.number(), z.null()])
    .transform((v) => (v == null || !Number.isFinite(v) || v <= 0 ? null : v)),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.string().nullable().optional(),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().nullable().optional(),
  installmentCount: z.number().int().min(1).max(48),
  tagNames: z.array(z.string()).optional().default([]),
});

export type GeminiPurchaseDraft = z.infer<typeof geminiPurchaseDraftSchema>;

export type ParsedPurchaseVoice = {
  title: string;
  description: string;
  amount: number | null;
  purchaseDate: string;
  categoryId: string;
  paymentSourceType: "account" | "pocket" | "card";
  paymentSourceId: string;
  installmentCount: number;
  tagNames: string[];
};

const responseJsonSchema = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
      description: "Título curto da despesa (ex.: Mercado, Uber).",
    },
    description: {
      type: "STRING",
      nullable: true,
      description: "Detalhe opcional; null se não houver.",
    },
    amount: {
      type: "NUMBER",
      nullable: true,
      description: "Valor total em reais (número). null se não for possível inferir.",
    },
    purchaseDate: {
      type: "STRING",
      description: "Data yyyy-MM-dd. Use a data de referência se não for dita.",
    },
    categoryId: {
      type: "STRING",
      nullable: true,
      description: "id de uma categoria da lista, ou null.",
    },
    paymentSourceType: {
      type: "STRING",
      enum: ["account", "pocket", "card"],
      description: "account=conta corrente; pocket=caixinha; card=cartão.",
    },
    paymentSourceId: {
      type: "STRING",
      nullable: true,
      description: "id da caixinha ou cartão da lista; null para conta corrente.",
    },
    installmentCount: {
      type: "INTEGER",
      description: "Número de parcelas (1 se à vista).",
    },
    tagNames: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Nomes de tags existentes que façam sentido; lista vazia se nenhuma.",
    },
  },
  required: ["title", "amount", "purchaseDate", "paymentSourceType", "installmentCount", "tagNames"],
};

function todayYmdSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function loadPurchaseParseContext(): Promise<PurchaseParseContext> {
  const [pockets, cards, categories, tags] = await Promise.all([
    getPocketBalances(),
    db
      .select({ id: schema.cards.id, name: schema.cards.name })
      .from(schema.cards)
      .orderBy(asc(schema.cards.name)),
    db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .orderBy(asc(schema.categories.name)),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .orderBy(asc(schema.tags.name)),
  ]);

  return {
    todayYmd: todayYmdSaoPaulo(),
    pockets: pockets.map((p) => ({ id: p.id, name: p.name })),
    cards,
    categories,
    tags,
  };
}

function buildContextRules(ctx: PurchaseParseContext): string {
  return `Você extrai dados de uma despesa a partir de fala natural em português do Brasil.
Não invente ids. Só use ids que aparecem nas listas abaixo. Se não tiver certeza, use null.

Data de referência (hoje): ${ctx.todayYmd}

Caixinhas (pocket): ${JSON.stringify(ctx.pockets)}
Cartões (card): ${JSON.stringify(ctx.cards)}
Categorias: ${JSON.stringify(ctx.categories)}
Tags (use os nomes em tagNames): ${JSON.stringify(ctx.tags.map((t) => t.name))}

Regras:
- title: nome curto da despesa.
- amount: valor total em reais; "quarenta e cinco" = 45. Se não houver valor claro, null.
- purchaseDate: yyyy-MM-dd; se não mencionada, use ${ctx.todayYmd}.
- paymentSourceType: account (conta/débito/conta corrente), pocket (caixinha), card (cartão/crédito/nubank etc. se for cartão).
- paymentSourceId: obrigatório id da lista para pocket/card; para account use null.
- installmentCount: "em 3 vezes" / "3x" = 3; default 1.
- categoryId / tagNames: só se casar com a lista; senão null / [].`;
}

function buildTranscriptPrompt(transcript: string, ctx: PurchaseParseContext): string {
  return `${buildContextRules(ctx)}

Transcrição do usuário:
"""${transcript}"""`;
}

function buildAudioPrompt(ctx: PurchaseParseContext): string {
  return `${buildContextRules(ctx)}

O áudio anexo é a fala do usuário descrevendo a despesa. Ouça e preencha o JSON.`;
}

function sanitizeDraft(draft: GeminiPurchaseDraft, ctx: PurchaseParseContext): ParsedPurchaseVoice {
  const categoryIds = new Set(ctx.categories.map((c) => c.id));
  const pocketIds = new Set(ctx.pockets.map((p) => p.id));
  const cardIds = new Set(ctx.cards.map((c) => c.id));
  const tagNameSet = new Set(ctx.tags.map((t) => t.name.toLowerCase()));

  let paymentSourceType = draft.paymentSourceType;
  let paymentSourceId = draft.paymentSourceId?.trim() || "";

  if (paymentSourceType === "pocket") {
    if (!paymentSourceId || !pocketIds.has(paymentSourceId)) {
      paymentSourceType = "account";
      paymentSourceId = "";
    }
  } else if (paymentSourceType === "card") {
    if (!paymentSourceId || !cardIds.has(paymentSourceId)) {
      paymentSourceType = "account";
      paymentSourceId = "";
    }
  } else {
    paymentSourceType = "account";
    paymentSourceId = "";
  }

  const categoryId =
    draft.categoryId && categoryIds.has(draft.categoryId) ? draft.categoryId : "";

  const tagNames = (draft.tagNames ?? [])
    .map((n) => n.trim())
    .filter((n) => n && tagNameSet.has(n.toLowerCase()));

  const purchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate)
    ? draft.purchaseDate
    : ctx.todayYmd;

  return {
    title: draft.title.trim(),
    description: (draft.description ?? "").trim(),
    amount: draft.amount != null && Number.isFinite(draft.amount) && draft.amount > 0 ? draft.amount : null,
    purchaseDate,
    categoryId,
    paymentSourceType,
    paymentSourceId,
    installmentCount: Math.min(48, Math.max(1, Math.round(draft.installmentCount) || 1)),
    tagNames,
  };
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function callGeminiParse(parts: GeminiPart[], ctx: PurchaseParseContext): Promise<ParsedPurchaseVoice> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: responseJsonSchema,
      },
    }),
  });

  const raw = (await response.json().catch(() => null)) as GeminiGenerateResponse | null;

  if (!response.ok) {
    const msg = raw?.error?.message ?? `Gemini HTTP ${response.status}`;
    throw new Error(msg);
  }

  const text = raw?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Gemini não retornou conteúdo");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Resposta do Gemini não é JSON válido");
  }

  const parsed = geminiPurchaseDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Resposta do Gemini fora do schema esperado");
  }

  return sanitizeDraft(parsed.data, ctx);
}

export async function parsePurchaseFromTranscript(
  transcript: string,
  ctx: PurchaseParseContext,
): Promise<ParsedPurchaseVoice> {
  return callGeminiParse([{ text: buildTranscriptPrompt(transcript, ctx) }], ctx);
}

export async function parsePurchaseFromAudio(
  audioBase64: string,
  mimeType: string,
  ctx: PurchaseParseContext,
): Promise<ParsedPurchaseVoice> {
  const cleanMime = mimeType.split(";")[0]?.trim() || "audio/webm";
  const data = audioBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!data) {
    throw new Error("Áudio vazio");
  }
  if (data.length > MAX_AUDIO_BASE64_CHARS) {
    throw new Error("Áudio muito longo — fale de novo em menos de ~30 segundos");
  }

  return callGeminiParse(
    [
      { text: buildAudioPrompt(ctx) },
      { inlineData: { mimeType: cleanMime, data } },
    ],
    ctx,
  );
}
