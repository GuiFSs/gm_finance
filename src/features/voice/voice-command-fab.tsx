"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  voiceCommandCanExecute,
  voiceCommandSummary,
  voiceCommandTitle,
} from "@/features/voice/voice-preview";
import { useCurrentUser } from "@/shared/hooks/use-auth";
import {
  useCards,
  useCategories,
  useCreateAdjustment,
  useCreateDeposit,
  useCreatePocket,
  useCreatePurchase,
  usePockets,
  useTags,
  useUpdatePocket,
} from "@/shared/hooks/use-finance";
import { fetcher } from "@/shared/lib/fetcher";
import type { ParsedVoiceCommand } from "@/shared/lib/gemini-parse-voice-command";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { toInputDate } from "@/shared/utils/formatters";

type VoiceUiState = "idle" | "listening" | "parsing";

const MAX_VOICE_MS = 30_000;

type VoiceParseResponse = { data: ParsedVoiceCommand };

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

export const VOICE_OPEN_EVENT = "gm:voice-open";

export function VoiceCommandFab() {
  const currentUser = useCurrentUser();
  const pockets = usePockets();
  const cards = useCards();
  const categories = useCategories();
  const tags = useTags();

  const createPocket = useCreatePocket();
  const updatePocket = useUpdatePocket();
  const createAdjustment = useCreateAdjustment();
  const createDeposit = useCreateDeposit();
  const createPurchase = useCreatePurchase();

  const [recordOpen, setRecordOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceUiState>("idle");
  const [pendingCommand, setPendingCommand] = useState<ParsedVoiceCommand | null>(null);
  const [executing, setExecuting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardRecordingRef = useRef(false);
  const voiceStateRef = useRef<VoiceUiState>("idle");

  const setVoiceUi = (next: VoiceUiState) => {
    voiceStateRef.current = next;
    setVoiceState(next);
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearVoiceTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        discardRecordingRef.current = true;
        recorder.stop();
      }
      stopMediaTracks();
    };
  }, []);

  const resetRecordingUi = () => {
    clearVoiceTimer();
    discardRecordingRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopMediaTracks();
      setVoiceUi("idle");
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
      const res = await fetcher<VoiceParseResponse>("/api/voice/parse", {
        method: "POST",
        body: JSON.stringify({
          audioBase64,
          mimeType: mimeType.split(";")[0] || "audio/webm",
        }),
      });
      setPendingCommand(res.data);
      setRecordOpen(false);
      setConfirmOpen(true);
      setVoiceUi("idle");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao interpretar a fala");
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

  const openRecorder = () => {
    setPendingCommand(null);
    setRecordOpen(true);
    setVoiceUi("idle");
  };

  useEffect(() => {
    const onOpen = () => {
      setPendingCommand(null);
      setRecordOpen(true);
      setVoiceUi("idle");
    };
    window.addEventListener(VOICE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VOICE_OPEN_EVENT, onOpen);
  }, []);

  const closeRecorder = (open: boolean) => {
    if (!open) {
      if (voiceState === "parsing") return;
      resetRecordingUi();
      setRecordOpen(false);
      return;
    }
    setRecordOpen(true);
  };

  const closeConfirm = (open: boolean) => {
    if (executing) return;
    setConfirmOpen(open);
    if (!open) setPendingCommand(null);
  };

  const executeCommand = async () => {
    const command = pendingCommand;
    const userId = currentUser.data?.id;
    if (!command || !userId || !voiceCommandCanExecute(command)) return;

    setExecuting(true);
    try {
      switch (command.intent) {
        case "create_pocket": {
          await createPocket.mutateAsync({
            name: command.name,
            description: command.description || undefined,
            initialAmount: command.initialAmount,
            createdByUserId: userId,
          });
          toast.success(`Caixinha “${command.name}” criada`);
          break;
        }
        case "set_pocket_balance": {
          if (command.newDescription != null) {
            await updatePocket.mutateAsync({
              id: command.pocketId,
              name: command.pocketName,
              description: command.newDescription || null,
            });
          }
          if (Math.abs(command.balanceDelta) > 1e-6) {
            await createAdjustment.mutateAsync({
              targetType: "pocket",
              targetId: command.pocketId,
              amount: command.balanceDelta,
              reason: "Ajuste de saldo (voz)",
              adjustmentDate: toInputDate(new Date()),
              createdByUserId: userId,
            });
          }
          const bits: string[] = [];
          if (Math.abs(command.balanceDelta) > 1e-6) bits.push("saldo");
          if (command.newDescription != null) bits.push("descrição");
          toast.success(
            bits.length
              ? `Caixinha “${command.pocketName}” atualizada (${bits.join(" e ")})`
              : `Caixinha “${command.pocketName}” atualizada`,
          );
          break;
        }
        case "create_deposit": {
          const splits =
            command.targetType === "pocket"
              ? [
                  {
                    targetType: "pocket" as const,
                    pocketId: command.pocketId,
                    amount: command.amount,
                  },
                ]
              : [{ targetType: "account" as const, amount: command.amount }];
          await createDeposit.mutateAsync({
            title: command.title,
            amount: command.amount,
            depositDate: command.depositDate,
            createdByUserId: userId,
            splits,
          });
          toast.success("Depósito registrado");
          break;
        }
        case "create_purchase": {
          const p = command.purchase;
          if (p.amount == null || p.amount <= 0) {
            toast.error("Valor da despesa inválido");
            break;
          }
          const tagIds = (tags.data ?? [])
            .filter((t) => p.tagNames.some((n) => n.toLowerCase() === t.name.toLowerCase()))
            .map((t) => t.id);
          await createPurchase.mutateAsync({
            title: p.title,
            description: p.description || undefined,
            amount: p.amount,
            purchaseDate: p.purchaseDate,
            categoryId: p.categoryId || undefined,
            paymentSourceType: p.paymentSourceType,
            paymentSourceId: p.paymentSourceId || undefined,
            installmentCount: p.installmentCount,
            tagIds,
            createdByUserId: userId,
          });
          toast.success("Despesa registrada");
          break;
        }
        default:
          break;
      }
      setConfirmOpen(false);
      setPendingCommand(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível executar o comando");
    } finally {
      setExecuting(false);
    }
  };

  const summary =
    pendingCommand &&
    voiceCommandSummary(pendingCommand, {
      pockets: pockets.data,
      cards: cards.data,
      categories: categories.data,
    });

  const canExecute = pendingCommand ? voiceCommandCanExecute(pendingCommand) : false;

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 z-40 hidden size-12 border border-border bg-card text-foreground hover:bg-accent md:inline-flex"
        aria-label="Comando por voz"
        onClick={openRecorder}
      >
        <Mic className="h-5 w-5" />
      </Button>

      <Dialog open={recordOpen} onOpenChange={closeRecorder}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="pr-8">comando por voz</DialogTitle>
            <DialogDescription>
              Exemplos: “criar caixinha Viagem”, “atualizar caixinha Carro para 1000”, “depósito de
              500”, “despesa mercado 80 reais”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {voiceState === "idle" && (
              <Button type="button" className="w-full" onClick={() => void startRecording()}>
                <Mic className="mr-2 h-4 w-4" />
                Falar
              </Button>
            )}
            {voiceState === "listening" && (
              <div className="flex flex-col gap-3">
                <p className="text-center text-[15px] text-muted-foreground">Ouvindo… (máx. 30s)</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      finishRecorder("discard");
                      toast.message("Gravação cancelada");
                    }}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Parar
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => finishRecorder("send")}>
                    Enviar
                  </Button>
                </div>
              </div>
            )}
            {voiceState === "parsing" && (
              <div className="flex items-center justify-center gap-2 py-6 text-[15px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Interpretando…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={closeConfirm}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>
              {pendingCommand ? voiceCommandTitle(pendingCommand) : "Confirmar"}
            </DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>

          {pendingCommand?.intent === "create_purchase" &&
            (pendingCommand.purchase.amount == null || pendingCommand.purchase.amount <= 0) && (
              <p className="text-[15px] text-ink-out">
                Valor da despesa não foi entendido. Cancele e fale de novo, ou cadastre pela tela de
                Compras.
              </p>
            )}

          {pendingCommand?.intent === "set_pocket_balance" &&
            Math.abs(pendingCommand.balanceDelta) <= 1e-6 &&
            pendingCommand.newDescription == null && (
              <p className="text-[15px] text-muted-foreground">
                Nada a alterar — diga um novo saldo e/ou uma nova descrição.
              </p>
            )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={executing}
              onClick={() => closeConfirm(false)}
            >
              Cancelar
            </Button>
            {pendingCommand?.intent !== "unknown" && (
              <Button
                type="button"
                disabled={!canExecute || executing || !currentUser.data?.id}
                onClick={() => void executeCommand()}
              >
                {executing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executando…
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
