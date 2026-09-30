"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {status === "subscribed" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          Alertas de vencimento
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Receba um aviso no celular/desktop quando faturas, compras ou recorrentes vencerem hoje ou
          amanhã. No iPhone, instale o app na Tela de Início.
        </p>
      </CardHeader>
      <CardContent>
        {status === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            Push não disponível neste navegador (ou o app ainda não está em modo PWA / produção).
          </p>
        )}
        {status === "denied" && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
            Permissão bloqueada nas configurações do navegador/sistema.
          </p>
        )}
        {status === "unsubscribed" && (
          <Button type="button" onClick={subscribe} disabled={busy}>
            Ativar notificações
          </Button>
        )}
        {status === "subscribed" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Notificações ativas neste dispositivo.</p>
            <Button type="button" variant="outline" size="sm" onClick={unsubscribe} disabled={busy}>
              Desativar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
