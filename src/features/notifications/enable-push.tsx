"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";

type PushStatus = "unsupported" | "loading" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function EnablePushCard() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const reg = await getRegistration();
      if (!reg) {
        // PWA SW só registra em production build
        if (!cancelled) setStatus("unsupported");
        return;
      }
      const existing = await reg.pushManager.getSubscription();
      if (!cancelled) setStatus(existing ? "subscribed" : "unsubscribed");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        toast.error("Permissão de notificação negada");
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      const keyJson = (await keyRes.json()) as { data?: { publicKey: string }; error?: string };
      if (!keyRes.ok || !keyJson.data?.publicKey) {
        throw new Error(keyJson.error || "Chave VAPID não configurada");
      }

      const reg = await getRegistration();
      if (!reg) throw new Error("Service worker indisponível (use o app instalado / build de produção)");

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.data.publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Falha ao registrar subscription");

      setStatus("subscribed");
      toast.success("Notificações ativadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ativar notificações");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await getRegistration();
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
      toast.success("Notificações desativadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao desativar");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return null;

  return (
    <section aria-labelledby="push-heading" className="border-t-2 border-foreground pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="push-heading" className="flex items-center gap-2 text-[15px] font-bold lowercase text-foreground">
            {status === "subscribed" ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            alertas de vencimento
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {status === "unsupported"
              ? "Indisponível neste navegador. No iPhone, instale o app na Tela de Início."
              : status === "denied"
                ? "Bloqueado nas configurações do navegador."
                : status === "subscribed"
                  ? "Ativo neste aparelho: um aviso por dia do que vence hoje ou amanhã."
                  : "Um aviso por dia do que vence hoje ou amanhã."}
          </p>
        </div>
        {status === "unsubscribed" ? (
          <Button type="button" size="sm" onClick={subscribe} disabled={busy}>
            ativar
          </Button>
        ) : status === "subscribed" ? (
          <Button type="button" variant="ghost" size="sm" onClick={unsubscribe} disabled={busy}>
            desativar
          </Button>
        ) : status === "denied" ? (
          <BellOff className="size-4 text-muted-foreground" aria-hidden />
        ) : null}
      </div>
    </section>
  );
}
