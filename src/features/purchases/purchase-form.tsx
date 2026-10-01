"use client";

import { addMonths, format } from "date-fns";
import { Loader2, Mic, Plus, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  useCreatePurchase,
  useCreateTag,
  useCurrentUser,
  useCategories,
  useCreateCategory,
  useTags,
  usePockets,
  useCards,
  useDashboard,
  usePurchaseDetail,
  useUpdatePurchase,
} from "@/shared/hooks/use-app-data";
import { fetcher } from "@/shared/lib/fetcher";
import { formatCurrency, formatDisplayDate, parseLocalDateYmd, toInputDate } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectOptions } from "@/shared/ui/select-options";

type VoiceParseResponse = {
  data: {
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
};

type VoiceUiState = "idle" | "listening" | "parsing";

const MAX_VOICE_MS = 30_000;

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler áudio"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 ?? "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler áudio"));
    reader.readAsDataURL(blob);
  });
}

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  purchaseDate: z.string().min(1),
  categoryId: z.string().optional(),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().optional(),
  installmentCount: z.number().int().min(1).max(48),
  tagIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_FORM_VALUES = (): FormValues => ({
  title: "",
  description: "",
  amount: 0,
  purchaseDate: toInputDate(new Date()),
  categoryId: "",
  paymentSourceType: "account",
  paymentSourceId: "",
  installmentCount: 1,
  tagIds: [],
});

async function resolveTagIdsForSubmit(
  raw: string,
  existingTags: Array<{ id: string; name: string }>,
  createTag: { mutateAsync: (input: Record<string, unknown>) => Promise<unknown> },
  userId: string
): Promise<string[]> {
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return [];
  let byLower = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    let id = byLower.get(key);
    if (!id) {
      const res = (await createTag.mutateAsync({
        name,
        createdByUserId: userId,
      })) as { data: { id: string; name: string } };
      id = res.data.id;
      byLower = new Map(byLower).set(key, id);
    }
    ids.push(id);
  }
  return [...new Set(ids)];
}

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 space-y-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export type PurchaseFormProps = {
  /** Quando definido, o formulário é usado dentro de um modal: ao salvar chama onSuccess e não redireciona */
  onSuccess?: () => void;
  /** Chamado ao cancelar (ex.: fechar modal) */
  onCancel?: () => void;
  /** Edição: ID de qualquer parcela do grupo (substitui o grupo inteiro ao salvar). */
  purchaseId?: string | null;
};

/**
 * Só monta depois de detalhe + categorias (+ fontes) carregados.
 * `useForm(defaultValues)` na 1ª montagem com os dados certos — Radix Select exibe o rótulo (a prop `values` do RHF não bastava).
 */
function PurchaseFormFields({
  purchaseId,
  initialValues,
  onSuccess,
  onCancel,
}: PurchaseFormProps & { initialValues: FormValues }) {
  const router = useRouter();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const detail = usePurchaseDetail(purchaseId ?? null);
  const currentUser = useCurrentUser();
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const createTag = useCreateTag();
  const tags = useTags();
  const pockets = usePockets();
  const cards = useCards();
  const dashboard = useDashboard();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  const { control, reset } = form;

  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [tagsField, setTagsField] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceUiState>("idle");
  const [voiceFillKey, setVoiceFillKey] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = useRef<VoiceUiState>("idle");
  /** Se true, o próximo `onstop` descarta o áudio sem enviar. */
  const discardRecordingRef = useRef(false);

  const setVoiceUi = (next: VoiceUiState) => {
    voiceStateRef.current = next;
    setVoiceState(next);
  };

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!purchaseId || !detail.data) return;
    const d = detail.data;
    if (categories.data === undefined) return;
    if (d.paymentSourceType === "pocket" && pockets.data === undefined) return;
    if (d.paymentSourceType === "card" && cards.data === undefined) return;

    const byId = new Map((tags.data ?? []).map((t) => [t.id, t.name]));
    setTagsField(d.tagIds.map((id) => byId.get(id)).filter(Boolean).join(", "));
  }, [purchaseId, detail.data, tags.data, categories.data, pockets.data, cards.data]);

  useEffect(() => {
    if (purchaseId) return;
    setTagsField("");
    reset(EMPTY_FORM_VALUES());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intencionais
  }, [purchaseId]);

  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      clearVoiceTimer();
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopMediaTracks();
    };
  }, []);

  const applyVoiceParseResult = (d: VoiceParseResponse["data"]) => {
    const tagIds = (tags.data ?? [])
      .filter((t) => d.tagNames.some((n) => n.toLowerCase() === t.name.toLowerCase()))
      .map((t) => t.id);

    reset({
      title: d.title,
      description: d.description ?? "",
      amount: d.amount != null && d.amount > 0 ? d.amount : 0,
      purchaseDate: d.purchaseDate || toInputDate(new Date()),
      categoryId: d.categoryId ?? "",
      paymentSourceType: d.paymentSourceType,
      paymentSourceId: d.paymentSourceType === "account" ? "" : (d.paymentSourceId ?? ""),
      installmentCount: d.installmentCount || 1,
      tagIds,
    });
    setTagsField(d.tagNames.join(", "));
    setVoiceFillKey((k) => k + 1);

    if (d.amount == null || d.amount <= 0) {
      toast.message("Revise o formulário", {
        description: "Não entendi o valor — complete e salve.",
      });
    } else {
      toast.success("Despesa interpretada — revise e salve");
    }
  };

  const parseRecordedAudio = async (blob: Blob, mimeType: string) => {
    setVoiceUi("parsing");
    try {
      if (blob.size < 500) {
        toast.error("Gravação muito curta — tente de novo");
        setVoiceUi("idle");
        return;
      }
      const audioBase64 = await blobToBase64(blob);
      const res = await fetcher<VoiceParseResponse>("/api/purchases/parse-voice", {
        method: "POST",
        body: JSON.stringify({
          audioBase64,
          mimeType: mimeType.split(";")[0] || "audio/webm",
        }),
      });
      applyVoiceParseResult(res.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao interpretar a fala");
    } finally {
      setVoiceUi("idle");
    }
  };

  const finishRecorder = (mode: "send" | "discard") => {
    clearVoiceTimer();
    discardRecordingRef.current = mode === "discard";
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    chunksRef.current = [];
    stopMediaTracks();
    setVoiceUi("idle");
  };

  const cancelRecording = () => {
    if (voiceStateRef.current !== "listening") return;
    finishRecorder("discard");
    toast.message("Gravação cancelada");
  };

  const sendRecording = () => {
    if (voiceStateRef.current !== "listening") return;
    finishRecorder("send");
  };

  const startRecording = async () => {
    if (voiceStateRef.current !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Gravação de áudio não disponível neste browser");
      return;
    }

    const mimeType = pickRecorderMimeType();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      discardRecordingRef.current = false;

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const usedMime = recorder.mimeType || mimeType || "audio/webm";

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        clearVoiceTimer();
        chunksRef.current = [];
        stopMediaTracks();
        setVoiceUi("idle");
        toast.error("Erro ao gravar áudio");
      };

      recorder.onstop = () => {
        clearVoiceTimer();
        stopMediaTracks();
        mediaRecorderRef.current = null;
        const shouldDiscard = discardRecordingRef.current;
        discardRecordingRef.current = false;
        const blob = new Blob(chunksRef.current, { type: usedMime });
        chunksRef.current = [];

        if (shouldDiscard) {
          setVoiceUi("idle");
          return;
        }
        void parseRecordedAudio(blob, usedMime);
      };

      recorder.start();
      setVoiceUi("listening");
      voiceTimerRef.current = setTimeout(() => {
        if (voiceStateRef.current === "listening") finishRecorder("send");
      }, MAX_VOICE_MS);
    } catch (error) {
      stopMediaTracks();
      setVoiceUi("idle");
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error("Permissão de microfone negada");
        return;
      }
      toast.error("Não foi possível iniciar o microfone");
    }
  };

  const paymentSourceType = useWatch({ control: form.control, name: "paymentSourceType" }) ?? "account";
  const paymentSourceId = useWatch({ control: form.control, name: "paymentSourceId" });
  const amount = useWatch({ control: form.control, name: "amount" }) ?? 0;
  const installmentCount = useWatch({ control: form.control, name: "installmentCount" }) ?? 1;
  const purchaseDateWatch = useWatch({ control: form.control, name: "purchaseDate" });
  const installments = Math.max(1, installmentCount);
  const amountPerInstallment = installments > 0 ? amount / installments : amount;
  const debitsFromBalance = paymentSourceType === "account" || paymentSourceType === "pocket";

  const debitSchedulePreview = useMemo(() => {
    if (!debitsFromBalance || !purchaseDateWatch) return [];
    const start = parseLocalDateYmd(purchaseDateWatch);
    if (Number.isNaN(start.getTime())) return [];
    return Array.from({ length: installments }, (_, i) => format(addMonths(start, i), "yyyy-MM-dd"));
  }, [debitsFromBalance, purchaseDateWatch, installments]);

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Digite o nome da categoria");
      return;
    }
    if (!currentUser.data?.id) return;
    const result = await createCategory.mutateAsync({
      name,
      createdByUserId: currentUser.data.id,
    });
    const created = result?.data as { id: string; name: string } | undefined;
    if (created?.id) {
      form.setValue("categoryId", created.id);
      setNewCategoryName("");
      setShowCreateCategory(false);
      toast.success("Categoria criada");
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const createdByUserId = currentUser.data?.id;
    if (!createdByUserId) {
      toast.error("Sessão inválida");
      return;
    }

    const categoryIdPayload = values.categoryId?.trim() ? values.categoryId.trim() : undefined;
    const tagIdsPayload = await resolveTagIdsForSubmit(tagsField, tags.data ?? [], createTag, createdByUserId);
    form.setValue("tagIds", tagIdsPayload);

    if (purchaseId) {
      await updatePurchase.mutateAsync({
        purchaseId,
        title: values.title,
        description: values.description,
        amount: values.amount,
        purchaseDate: values.purchaseDate,
        categoryId: categoryIdPayload,
        paymentSourceType: values.paymentSourceType,
        paymentSourceId: values.paymentSourceId || undefined,
        installmentCount: values.installmentCount,
        tagIds: tagIdsPayload,
      });
      toast.success("Despesa atualizada");
    } else {
      await createPurchase.mutateAsync({
        ...values,
        categoryId: categoryIdPayload,
        tagIds: tagIdsPayload,
        createdByUserId,
      });
      toast.success("Compra criada");
    }
    if (onSuccess) onSuccess();
    else router.push("/purchases");
  });

  const sourceOptions =
    paymentSourceType === "pocket"
      ? (pockets.data ?? []).map((item) => ({ value: item.id, label: `${item.name} (${item.balance.toFixed(2)})` }))
      : paymentSourceType === "card"
        ? (cards.data ?? []).map((item) => ({ value: item.id, label: item.name }))
        : [{ value: "", label: "Conta corrente" }];

  const checkingWouldBeNegative =
    paymentSourceType === "account" &&
    dashboard.data &&
    dashboard.data.checkingBalance - amountPerInstallment < 0;
  const selectedPocket = (pockets.data ?? []).find((item) => item.id === paymentSourceId);
  const pocketWouldBeNegative =
    paymentSourceType === "pocket" && selectedPocket ? selectedPocket.balance - amountPerInstallment < 0 : false;

  const isSaving = createPurchase.isPending || updatePurchase.isPending;

  /** Remonta os Select quando os valores iniciais da despesa mudam (edição) ou após preenchimento por voz. */
  const selectHydrationKey = `${initialValues.paymentSourceType}-${initialValues.paymentSourceId}-${initialValues.categoryId}-${initialValues.purchaseDate}-v${voiceFillKey}`;

  const formContent = (
    <form onSubmit={submit} className={onSuccess ? "space-y-5" : "space-y-8"}>
      {!purchaseId ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-3 dark:bg-muted/15">
          <p className="text-sm text-muted-foreground">
            {voiceState === "listening"
              ? "Gravando… Use Enviar para interpretar ou Parar para descartar (máx. 30s)."
              : voiceState === "parsing"
                ? "Interpretando o áudio…"
                : "Toque em Falar, diga a despesa e depois Enviar. O formulário será preenchido para você revisar."}
          </p>
          {voiceState === "listening" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 sm:w-auto"
                onClick={cancelRecording}
              >
                <X className="h-4 w-4" />
                Parar
              </Button>
              <Button type="button" className="h-11 w-full gap-2 sm:w-auto" onClick={sendRecording}>
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          ) : (
            <div className="flex sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full gap-2 sm:w-auto"
                onClick={() => void startRecording()}
                disabled={voiceState === "parsing"}
              >
                {voiceState === "parsing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Interpretando…
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Falar
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <FormSection title="Sobre a despesa" description="Nome e detalhes opcionais.">
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input id="title" {...form.register("title")} placeholder="Ex: Supermercado" />
          </div>
          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" {...form.register("description")} placeholder="Ex: Compras do mês" />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Valor, datas e pagamento"
        description={
          debitsFromBalance
            ? "Defina o valor, quando debitar do saldo e por onde sai o dinheiro."
            : "Valor, data da compra no cartão e forma de pagamento."
        }
      >
        <div className="rounded-xl border border-border bg-muted/25 p-4 shadow-sm dark:bg-muted/15">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">Valor {installments > 1 ? "total" : ""}</Label>
              <CurrencyInput
                id="amount"
                value={form.watch("amount") ?? 0}
                onChange={(v) => form.setValue("amount", v)}
              />
              {installments > 1 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {installments} × {formatCurrency(amountPerInstallment)}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="purchaseDate">
                {debitsFromBalance
                  ? installments > 1
                    ? "Data do 1º débito"
                    : "Data do débito"
                  : "Data da compra"}
              </Label>
              <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
              {debitsFromBalance ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {installments > 1
                    ? "Próximas parcelas: mesmo dia do mês, mês a mês."
                    : "Pode ser hoje ou uma data futura."}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">Usada na fatura do cartão.</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/80 pt-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="paymentSourceType">Pagar com</Label>
              <Controller
                name="paymentSourceType"
                control={control}
                render={({ field }) => (
                  <SelectOptions
                    key={`pay-type-${selectHydrationKey}`}
                    id="paymentSourceType"
                    value={field.value}
                    onValueChange={(v) => {
                      const type = v as FormValues["paymentSourceType"];
                      const prev = field.value;
                      field.onChange(type);
                      if (type !== prev) {
                        form.setValue("paymentSourceId", type === "account" ? "" : "");
                      }
                    }}
                    options={[
                      { value: "account", label: "Conta corrente" },
                      { value: "pocket", label: "Caixinha" },
                      { value: "card", label: "Cartão de crédito" },
                    ]}
                  />
                )}
              />
            </div>
            <div>
              <Label htmlFor="paymentSourceId">Fonte</Label>
              <Controller
                name="paymentSourceId"
                control={control}
                render={({ field }) => (
                  <SelectOptions
                    key={`pay-src-${paymentSourceType}-${selectHydrationKey}`}
                    id="paymentSourceId"
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v)}
                    options={sourceOptions}
                  />
                )}
              />
            </div>
            <div>
              <Label htmlFor="installmentCount">Parcelas</Label>
              <Input
                id="installmentCount"
                type="number"
                min={1}
                max={48}
                {...form.register("installmentCount", { valueAsNumber: true })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {debitsFromBalance ? "1 = à vista no saldo." : "1 = à vista no cartão."}
              </p>
            </div>
          </div>

          {debitsFromBalance && debitSchedulePreview.length > 0 ? (
            <div className="mt-4 rounded-lg border border-border/80 bg-background/80 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground">
                {installments > 1 ? "Quando será debitado" : "Débito"}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {debitSchedulePreview.map((iso, idx) => (
                  <li key={iso} className="flex justify-between gap-2 tabular-nums">
                    <span>
                      {installments > 1 ? (
                        <>
                          {idx + 1}/{installments}
                        </>
                      ) : (
                        "Saldo"
                      )}
                    </span>
                    <span className="font-medium text-foreground">{formatDisplayDate(iso)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Categoria" description="Opcional — ajuda a filtrar relatórios.">
        <div className="space-y-3">
          <div>
            <Label htmlFor="categoryId">Categoria</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <SelectOptions
                  key={`category-${selectHydrationKey}-${(categories.data ?? []).length}`}
                  id="categoryId"
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v)}
                  options={[
                    { value: "", label: "Sem categoria" },
                    ...(categories.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              )}
            />
          </div>
          {showCreateCategory ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/20">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="new-category-name" className="text-xs text-muted-foreground">
                  Nova categoria
                </Label>
                <Input
                  id="new-category-name"
                  placeholder="Ex: Alimentação"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCategory())}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={createCategory.isPending || !newCategoryName.trim()}
                >
                  {createCategory.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto gap-1.5 px-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowCreateCategory(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Criar nova categoria
            </Button>
          )}
        </div>
      </FormSection>

      <FormSection title="Tags" description="Nomes de tags já cadastradas, separados por vírgula.">
        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            placeholder="Ex: mercado, mensal"
            value={tagsField}
            onChange={(event) => {
              setTagsField(event.target.value);
              const lookup = new Map((tags.data ?? []).map((tag) => [tag.name.toLowerCase(), tag.id]));
              const ids = event.target.value
                .split(",")
                .map((item) => item.trim().toLowerCase())
                .map((name) => lookup.get(name))
                .filter((id): id is string => Boolean(id));
              form.setValue("tagIds", ids);
            }}
          />
        </div>
      </FormSection>

      {(checkingWouldBeNegative || pocketWouldBeNegative) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <Badge variant="destructive">Esta compra deixará o saldo negativo</Badge>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel ?? (() => router.push("/purchases"))}
          className="sm:order-2"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} className="w-full sm:w-auto sm:min-w-[140px]">
          {isSaving ? "Salvando..." : purchaseId ? "Salvar alterações" : "Salvar compra"}
        </Button>
      </div>
    </form>
  );

  if (onSuccess) {
    return formContent;
  }
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6 sm:p-8">
        <CardTitle className="mb-6">{purchaseId ? "Editar despesa" : "Nova compra"}</CardTitle>
        {formContent}
      </Card>
    </div>
  );
}

export function PurchaseForm({ onSuccess, onCancel, purchaseId = null }: PurchaseFormProps = {}) {
  const detail = usePurchaseDetail(purchaseId ?? null);
  const categories = useCategories();
  const pockets = usePockets();
  const cards = useCards();

  const editFormValues = useMemo((): FormValues | undefined => {
    if (!purchaseId || !detail.data) return undefined;
    const d = detail.data;
    if (categories.data === undefined) return undefined;
    if (d.paymentSourceType === "pocket" && pockets.data === undefined) return undefined;
    if (d.paymentSourceType === "card" && cards.data === undefined) return undefined;

    const paymentSourceIdValue =
      d.paymentSourceType === "account" ? "" : (d.paymentSourceId ?? "");

    return {
      title: d.title,
      description: d.description ?? "",
      amount: d.totalAmount,
      purchaseDate: d.firstPurchaseDate,
      categoryId: d.categoryId ?? "",
      paymentSourceType: d.paymentSourceType as FormValues["paymentSourceType"],
      paymentSourceId: paymentSourceIdValue,
      installmentCount: d.installments[0]?.installmentCount ?? 1,
      tagIds: d.tagIds ?? [],
    };
  }, [purchaseId, detail.data, categories.data, pockets.data, cards.data]);

  const isEditLoading = Boolean(purchaseId) && (detail.isLoading || !detail.data || !editFormValues);

  if (isEditLoading) {
    const spinner = (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">Carregando despesa…</p>
      </div>
    );
    if (onSuccess) return spinner;
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 sm:p-8">
          <CardTitle className="mb-6">Editar despesa</CardTitle>
          {spinner}
        </Card>
      </div>
    );
  }

  const initialValues: FormValues = purchaseId ? editFormValues! : EMPTY_FORM_VALUES();

  return (
    <PurchaseFormFields
      key={purchaseId ? `edit-${purchaseId}` : "new-purchase"}
      purchaseId={purchaseId}
      initialValues={initialValues}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}
