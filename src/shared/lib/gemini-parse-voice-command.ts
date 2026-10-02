import { asc } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { getPocketBalances } from "@/shared/lib/finance-service";
import {
  geminiPurchaseDraftSchema,
  type NamedId,
  type ParsedPurchaseVoice,
  parseVoiceRequestSchema,
} from "@/shared/lib/gemini-parse-purchase";

export { parseVoiceRequestSchema };

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const MAX_AUDIO_BASE64_CHARS = 4_000_000;

export type PocketWithBalance = NamedId & { balance: number; description: string };

export type VoiceCommandContext = {
  todayYmd: string;
  pockets: PocketWithBalance[];
  cards: NamedId[];
  categories: NamedId[];
  tags: NamedId[];
};

export const VOICE_INTENTS = [
  "create_purchase",
  "create_pocket",
  "set_pocket_balance",
  "create_deposit",
  "unknown",
] as const;

export type VoiceIntent = (typeof VOICE_INTENTS)[number];

/** Draft flat do Gemini (antes de sanitizar). */
export const geminiVoiceCommandDraftSchema = z.object({
  intent: z.enum(VOICE_INTENTS),
  clarificationMessage: z.string().trim().max(300).nullable().optional(),

  pocketName: z.string().trim().max(120).nullable().optional(),
  pocketDescription: z.string().trim().max(500).nullable().optional(),
  initialAmount: z
    .union([z.number(), z.null()])
    .optional()
    .transform((v) => (v == null || !Number.isFinite(v) || v < 0 ? null : v)),

  targetPocketId: z.string().nullable().optional(),
  targetPocketName: z.string().trim().max(120).nullable().optional(),
  newBalance: z
    .union([z.number(), z.null()])
    .optional()
    .transform((v) => (v == null || !Number.isFinite(v) || v < 0 ? null : v)),

  depositTitle: z.string().trim().max(200).nullable().optional(),
  depositAmount: z
    .union([z.number(), z.null()])
    .optional()
    .transform((v) => (v == null || !Number.isFinite(v) || v <= 0 ? null : v)),
  depositDate: z.string().nullable().optional(),
  depositTargetType: z.enum(["account", "pocket"]).nullable().optional(),
  depositPocketId: z.string().nullable().optional(),
  depositPocketName: z.string().trim().max(120).nullable().optional(),

  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  amount: z
    .union([z.number(), z.null()])
    .optional()
    .transform((v) => (v == null || !Number.isFinite(v) || v <= 0 ? null : v)),
  purchaseDate: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  paymentSourceType: z.enum(["account", "pocket", "card"]).nullable().optional(),
  paymentSourceId: z.string().nullable().optional(),
  installmentCount: z.number().int().min(1).max(48).nullable().optional(),
  tagNames: z.array(z.string()).optional().default([]),
});

export type GeminiVoiceCommandDraft = z.infer<typeof geminiVoiceCommandDraftSchema>;

export type ParsedVoiceCommand =
  | {
      intent: "create_purchase";
      purchase: ParsedPurchaseVoice;
    }
  | {
      intent: "create_pocket";
      name: string;
      description: string;
      initialAmount: number;
    }
  | {
      intent: "set_pocket_balance";
      pocketId: string;
      pocketName: string;
      currentBalance: number;
      newBalance: number;
      balanceDelta: number;
      /** null = não alterar descrição; string = novo texto (pode ser ""). */
      newDescription: string | null;
    }
  | {
      intent: "create_deposit";
      title: string;
      amount: number;
      depositDate: string;
      targetType: "account" | "pocket";
      pocketId: string;
      pocketName: string;
    }
  | {
      intent: "unknown";
      message: string;
    };

const responseJsonSchema = {
  type: "OBJECT",
  properties: {
    intent: {
      type: "STRING",
      enum: [...VOICE_INTENTS],
      description:
        "Tipo do comando. set_pocket_balance = atualizar caixinha existente (saldo e/ou descrição). create_pocket = criar caixinha nova. create_deposit = depósito. create_purchase = despesa. unknown = só se impossível classificar.",
    },
    clarificationMessage: {
      type: "STRING",
      nullable: true,
      description:
        "Só se intent=unknown: motivo curto. Nunca diga que atualizar caixinha não é suportado.",
    },
    pocketName: {
      type: "STRING",
      nullable: true,
      description: "Nome da nova caixinha (create_pocket) ou nome falado se útil em set_pocket_balance.",
    },
    pocketDescription: {
      type: "STRING",
      nullable: true,
      description:
        "Descrição da caixinha. Em create_pocket = descrição inicial. Em set_pocket_balance = nova descrição se o usuário pediu para mudar; null se não mencionou descrição.",
    },
    initialAmount: {
      type: "NUMBER",
      nullable: true,
      description: "Saldo inicial (create_pocket). Se for atualizar caixinha existente, use newBalance em set_pocket_balance.",
    },
    targetPocketId: {
      type: "STRING",
      nullable: true,
      description: "id da caixinha da lista para set_pocket_balance.",
    },
    targetPocketName: {
      type: "STRING",
      nullable: true,
      description: "Nome falado da caixinha em set_pocket_balance.",
    },
    newBalance: {
      type: "NUMBER",
      nullable: true,
      description:
        "Novo saldo FINAL da caixinha (>=0) para set_pocket_balance. null se o usuário só pediu mudar a descrição (sem falar valor).",
    },
    depositTitle: {
      type: "STRING",
      nullable: true,
      description: "Título do depósito; null gera default.",
    },
    depositAmount: {
      type: "NUMBER",
      nullable: true,
      description: "Valor do depósito (>0).",
    },
    depositDate: {
      type: "STRING",
      nullable: true,
      description: "Data yyyy-MM-dd do depósito.",
    },
    depositTargetType: {
      type: "STRING",
      enum: ["account", "pocket"],
      nullable: true,
      description: "Destino do depósito; account se não especificado.",
    },
    depositPocketId: {
      type: "STRING",
      nullable: true,
      description: "id da caixinha destino se depositTargetType=pocket.",
    },
    depositPocketName: {
      type: "STRING",
      nullable: true,
      description: "Nome falado da caixinha destino do depósito.",
    },
    title: {
      type: "STRING",
      nullable: true,
      description: "Título da despesa (create_purchase).",
    },
    description: {
      type: "STRING",
      nullable: true,
      description: "Detalhe da despesa.",
    },
    amount: {
      type: "NUMBER",
      nullable: true,
      description: "Valor total da despesa.",
    },
    purchaseDate: {
      type: "STRING",
      nullable: true,
      description: "Data yyyy-MM-dd da despesa.",
    },
    categoryId: {
      type: "STRING",
      nullable: true,
      description: "id de categoria da lista.",
    },
    paymentSourceType: {
      type: "STRING",
      enum: ["account", "pocket", "card"],
      nullable: true,
      description: "Fonte de pagamento da despesa.",
    },
    paymentSourceId: {
      type: "STRING",
      nullable: true,
      description: "id pocket/card; null para account.",
    },
    installmentCount: {
      type: "INTEGER",
      nullable: true,
      description: "Parcelas (1 se à vista).",
    },
    tagNames: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Nomes de tags existentes; [] se nenhuma.",
    },
  },
  required: ["intent", "tagNames"],
};

function todayYmdSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function loadVoiceCommandContext(): Promise<VoiceCommandContext> {
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
    pockets: pockets.map((p) => ({
      id: p.id,
      name: p.name,
      balance: Number(p.balance) || 0,
      description: (p.description ?? "").trim(),
    })),
    cards,
    categories,
    tags,
  };
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

/** Match case-insensitive (com/sem acento). soft=false exige nome igual. */
function resolvePocket(
  pockets: PocketWithBalance[],
  id: string | null | undefined,
  name: string | null | undefined,
  opts?: { soft?: boolean },
): PocketWithBalance | null {
  if (id) {
    const byId = pockets.find((p) => p.id === id);
    if (byId) return byId;
  }
  const needle = name?.trim() ? normalizeName(name) : "";
  if (!needle) return null;
  const matches = pockets.filter((p) => normalizeName(p.name) === needle);
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0 && opts?.soft !== false) {
    const soft = pockets.filter(
      (p) => normalizeName(p.name).includes(needle) || needle.includes(normalizeName(p.name)),
    );
    if (soft.length === 1) return soft[0]!;
  }
  return null;
}

function unknown(message: string): ParsedVoiceCommand {
  return { intent: "unknown", message };
}

function sanitizePurchase(draft: GeminiVoiceCommandDraft, ctx: VoiceCommandContext): ParsedPurchaseVoice | null {
  const title = draft.title?.trim();
  if (!title) return null;

  const purchaseParsed = geminiPurchaseDraftSchema.safeParse({
    title,
    description: draft.description ?? null,
    amount: draft.amount ?? null,
    purchaseDate:
      draft.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate)
        ? draft.purchaseDate
        : ctx.todayYmd,
    categoryId: draft.categoryId ?? null,
    paymentSourceType: draft.paymentSourceType ?? "account",
    paymentSourceId: draft.paymentSourceId ?? null,
    installmentCount: draft.installmentCount ?? 1,
    tagNames: draft.tagNames ?? [],
  });
  if (!purchaseParsed.success) return null;

  const d = purchaseParsed.data;
  const categoryIds = new Set(ctx.categories.map((c) => c.id));
  const pocketIds = new Set(ctx.pockets.map((p) => p.id));
  const cardIds = new Set(ctx.cards.map((c) => c.id));
  const tagNameSet = new Set(ctx.tags.map((t) => t.name.toLowerCase()));

  let paymentSourceType = d.paymentSourceType;
  let paymentSourceId = d.paymentSourceId?.trim() || "";

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

  return {
    title: d.title.trim(),
    description: (d.description ?? "").trim(),
    amount: d.amount != null && Number.isFinite(d.amount) && d.amount > 0 ? d.amount : null,
    purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(d.purchaseDate) ? d.purchaseDate : ctx.todayYmd,
    categoryId: d.categoryId && categoryIds.has(d.categoryId) ? d.categoryId : "",
    paymentSourceType,
    paymentSourceId,
    installmentCount: Math.min(48, Math.max(1, Math.round(d.installmentCount) || 1)),
    tagNames: (d.tagNames ?? [])
      .map((n) => n.trim())
      .filter((n) => n && tagNameSet.has(n.toLowerCase())),
  };
}

function buildSetPocketBalance(
  ctx: VoiceCommandContext,
  pocketId: string | null | undefined,
  pocketName: string | null | undefined,
  newBalance: number | null | undefined,
  opts?: { soft?: boolean; newDescription?: string | null },
): ParsedVoiceCommand | null {
  const pocket = resolvePocket(ctx.pockets, pocketId, pocketName, opts);
  if (!pocket) return null;

  const hasBalance = newBalance != null && Number.isFinite(newBalance) && newBalance >= 0;
  const hasDescription = opts?.newDescription != null;

  if (!hasBalance && !hasDescription) return null;

  const resolvedBalance = hasBalance ? newBalance! : pocket.balance;
  return {
    intent: "set_pocket_balance",
    pocketId: pocket.id,
    pocketName: pocket.name,
    currentBalance: pocket.balance,
    newBalance: resolvedBalance,
    balanceDelta: resolvedBalance - pocket.balance,
    newDescription: hasDescription ? opts!.newDescription! : null,
  };
}

/** Se o modelo mandou unknown/errado mas preencheu saldo/descrição + caixinha, recupera o intent. */
function recoverSetPocketBalance(
  draft: GeminiVoiceCommandDraft,
  ctx: VoiceCommandContext,
  opts?: { soft?: boolean },
): ParsedVoiceCommand | null {
  let newBalance: number | null = null;
  if (draft.newBalance != null && Number.isFinite(draft.newBalance) && draft.newBalance >= 0) {
    newBalance = draft.newBalance;
  } else {
    for (const v of [draft.amount, draft.depositAmount, draft.initialAmount]) {
      if (v != null && Number.isFinite(v) && v > 0) {
        newBalance = v;
        break;
      }
    }
  }

  const descriptionRaw = draft.pocketDescription;
  const newDescription =
    descriptionRaw != null && descriptionRaw.trim().length > 0 ? descriptionRaw.trim() : null;

  if (newBalance == null && newDescription == null) return null;

  return buildSetPocketBalance(
    ctx,
    draft.targetPocketId ?? draft.depositPocketId,
    draft.targetPocketName ?? draft.depositPocketName ?? draft.pocketName,
    newBalance,
    { ...opts, newDescription },
  );
}

export function sanitizeVoiceCommandDraft(
  draft: GeminiVoiceCommandDraft,
  ctx: VoiceCommandContext,
): ParsedVoiceCommand {
  switch (draft.intent) {
    case "create_pocket": {
      // "atualizar caixinha X para N" às vezes vem como create_pocket — se a caixinha já existe + valor/desc, atualiza.
      const recoveredFromCreate = recoverSetPocketBalance(draft, ctx, { soft: false });
      if (recoveredFromCreate) return recoveredFromCreate;

      const name = draft.pocketName?.trim();
      if (!name) {
        return unknown("Não entendi o nome da caixinha — tente de novo.");
      }
      const duplicate = ctx.pockets.some((p) => normalizeName(p.name) === normalizeName(name));
      if (duplicate) {
        return unknown(`Já existe uma caixinha chamada "${name}".`);
      }
      return {
        intent: "create_pocket",
        name,
        description: (draft.pocketDescription ?? "").trim(),
        initialAmount: draft.initialAmount ?? 0,
      };
    }
    case "set_pocket_balance": {
      let newBalance: number | null = null;
      if (draft.newBalance != null && Number.isFinite(draft.newBalance) && draft.newBalance >= 0) {
        newBalance = draft.newBalance;
      } else if (draft.initialAmount != null && draft.initialAmount > 0) {
        newBalance = draft.initialAmount;
      } else if (draft.amount != null && draft.amount > 0) {
        newBalance = draft.amount;
      }

      const descriptionRaw = draft.pocketDescription;
      const newDescription =
        descriptionRaw != null && String(descriptionRaw).trim().length > 0
          ? String(descriptionRaw).trim()
          : null;

      const built = buildSetPocketBalance(
        ctx,
        draft.targetPocketId,
        draft.targetPocketName ?? draft.pocketName,
        newBalance,
        { newDescription },
      );
      if (!built) {
        if (!resolvePocket(ctx.pockets, draft.targetPocketId, draft.targetPocketName ?? draft.pocketName)) {
          return unknown("Não encontrei a caixinha — diga o nome exatamente como no app.");
        }
        return unknown("Diga o novo saldo e/ou a nova descrição da caixinha.");
      }
      return built;
    }
    case "create_deposit": {
      if (draft.depositAmount == null) {
        return unknown("Não entendi o valor do depósito.");
      }
      let targetType: "account" | "pocket" = draft.depositTargetType ?? "account";
      let pocketId = "";
      let pocketName = "";

      if (targetType === "pocket" || draft.depositPocketId || draft.depositPocketName) {
        const pocket = resolvePocket(ctx.pockets, draft.depositPocketId, draft.depositPocketName);
        if (!pocket) {
          if (draft.depositPocketName || draft.depositPocketId) {
            return unknown("Não encontrei a caixinha de destino do depósito.");
          }
          targetType = "account";
        } else {
          targetType = "pocket";
          pocketId = pocket.id;
          pocketName = pocket.name;
        }
      }

      const depositDate =
        draft.depositDate && /^\d{4}-\d{2}-\d{2}$/.test(draft.depositDate)
          ? draft.depositDate
          : ctx.todayYmd;

      return {
        intent: "create_deposit",
        title: (draft.depositTitle ?? "").trim() || "Depósito",
        amount: draft.depositAmount,
        depositDate,
        targetType,
        pocketId,
        pocketName,
      };
    }
    case "create_purchase": {
      const purchase = sanitizePurchase(draft, ctx);
      if (!purchase) {
        return unknown("Não entendi a despesa — diga título e valor.");
      }
      return { intent: "create_purchase", purchase };
    }
    case "unknown":
    default: {
      const recovered = recoverSetPocketBalance(draft, ctx);
      if (recovered) return recovered;

      const rawMsg = draft.clarificationMessage?.trim() ?? "";
      const misleading =
        /não (é|está) suportad|não suportado|não suportada|não (é|está) disponível/i.test(rawMsg);
      return unknown(
        !rawMsg || misleading
          ? "Não entendi o comando. Exemplos: criar caixinha Viagem; atualizar caixinha Carro para 1000 com descrição IPVA; depósito de 500; despesa mercado 80 reais."
          : rawMsg,
      );
    }
  }
}

function buildContextRules(ctx: VoiceCommandContext): string {
  return `Você classifica e extrai um comando de finanças a partir de fala em português do Brasil.
Escolha exatamente um intent. Não invente ids — só use ids das listas.

IMPORTANTE — caixinhas (set_pocket_balance):
- "atualizar", "editar", "modificar", "alterar", "mudar", "definir" + caixinha = SEMPRE intent=set_pocket_balance (nunca unknown).
- Pode mudar SALDO e/ou DESCRIÇÃO no MESMO comando.
- Exemplos:
  - "atualizar caixinha Carro para 1000" → newBalance=1000, pocketDescription=null
  - "atualizar caixinha Carro para 1000 com descrição reserva do IPVA" → newBalance=1000 e pocketDescription="reserva do IPVA"
  - "muda a descrição da caixinha Viagem para férias 2026" → pocketDescription="férias 2026", newBalance=null
- Preencha targetPocketId (id da lista) OU targetPocketName.
- newBalance = saldo FINAL desejado (>=0), não incremento; null se só mudou descrição.
- pocketDescription = texto novo da descrição se o usuário pediu; null se não falou de descrição.

Data de referência (hoje): ${ctx.todayYmd}

Caixinhas (id, name, balance, description): ${JSON.stringify(ctx.pockets)}
Cartões: ${JSON.stringify(ctx.cards)}
Categorias: ${JSON.stringify(ctx.categories)}
Tags (nomes para tagNames): ${JSON.stringify(ctx.tags.map((t) => t.name))}

Outros intents:
- create_pocket: só para CRIAR caixinha nova ("criar caixinha X", "nova caixinha para viagem"). Preencha pocketName; initialAmount/pocketDescription se ditos.
- create_deposit: "novo depósito de 500", "recebi 1000 na caixinha X". Preencha depositAmount; depositTargetType account se não citar caixinha; senão pocket + id/nome.
- create_purchase: "gastei 80 no mercado", "despesa uber 25 no cartão". Preencha title, amount, paymentSource*, installmentCount.
- unknown: só se realmente impossível classificar. Nunca diga que atualizar caixinha/descrição "não é suportado".

Regras de valor: "mil" / "1 mil" = 1000; "quarenta e cinco" = 45. Datas yyyy-MM-dd; se omitidas use ${ctx.todayYmd}.`;
}

function buildAudioPrompt(ctx: VoiceCommandContext): string {
  return `${buildContextRules(ctx)}

O áudio anexo é o comando do usuário. Ouça e preencha o JSON.`;
}

function buildTranscriptPrompt(transcript: string, ctx: VoiceCommandContext): string {
  return `${buildContextRules(ctx)}

Transcrição do usuário:
"""${transcript}"""`;
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

async function callGeminiVoiceParse(
  parts: GeminiPart[],
  ctx: VoiceCommandContext,
): Promise<ParsedVoiceCommand> {
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

  const parsed = geminiVoiceCommandDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Resposta do Gemini fora do schema esperado");
  }

  return sanitizeVoiceCommandDraft(parsed.data, ctx);
}

export async function parseVoiceCommandFromTranscript(
  transcript: string,
  ctx: VoiceCommandContext,
): Promise<ParsedVoiceCommand> {
  return callGeminiVoiceParse([{ text: buildTranscriptPrompt(transcript, ctx) }], ctx);
}

export async function parseVoiceCommandFromAudio(
  audioBase64: string,
  mimeType: string,
  ctx: VoiceCommandContext,
): Promise<ParsedVoiceCommand> {
  const cleanMime = mimeType.split(";")[0]?.trim() || "audio/webm";
  const data = audioBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!data) {
    throw new Error("Áudio vazio");
  }
  if (data.length > MAX_AUDIO_BASE64_CHARS) {
    throw new Error("Áudio muito longo — fale de novo em menos de ~30 segundos");
  }

  return callGeminiVoiceParse(
    [
      { text: buildAudioPrompt(ctx) },
      { inlineData: { mimeType: cleanMime, data } },
    ],
    ctx,
  );
}
