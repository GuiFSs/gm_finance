"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Landmark,
  LayoutGrid,
  Menu,
  Mic,
  PieChart,
  PiggyBank,
  Plus,
  ReceiptText,
  Repeat,
  Tags,
  Target,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { VOICE_OPEN_EVENT, VoiceCommandFab } from "@/features/voice/voice-command-fab";
import { cn } from "@/shared/lib/cn";
import { useLogout } from "@/shared/hooks/use-auth";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

const NEW_PURCHASE_HREF = "/purchases?new=1";

const NAV_ITEMS = [
  { href: "/dashboard", label: "início", icon: LayoutGrid },
  { href: "/movements", label: "movimentos", icon: CalendarDays },
  { href: "/purchases", label: "compras", icon: ReceiptText },
  { href: "/budgets", label: "orçamento", icon: PieChart },
  { href: "/categories", label: "categorias", icon: Tags },
  { href: "/pockets", label: "caixinhas", icon: PiggyBank },
  { href: "/cards", label: "cartões", icon: WalletCards },
  { href: "/recurring", label: "recorrentes", icon: Repeat },
  { href: "/goals", label: "metas", icon: Target },
  { href: "/deposits", label: "depósitos", icon: Landmark },
];

const MAIN_HREFS = new Set(["/dashboard", "/movements", "/purchases"]);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideNav({
  pathname,
  onNavigate,
  skipMain,
}: {
  pathname: string;
  onNavigate?: () => void;
  skipMain?: boolean;
}) {
  return (
    <nav className="space-y-px" aria-label="Navegação">
      {NAV_ITEMS.filter((item) => !skipMain || !MAIN_HREFS.has(item.href)).map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Wordmark() {
  return (
    <div>
      <p className="text-2xl font-bold lowercase leading-none tracking-tight text-foreground">g&amp;m</p>
      <p className="mt-1 text-[15px] lowercase text-muted-foreground">gestão da casa</p>
    </div>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutGrid; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-14 flex-1 flex-col items-center justify-center gap-1 text-xs lowercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className={cn(active && "font-medium")}>{label}</span>
      <span className={cn("h-0.5 w-5", active ? "bg-foreground" : "bg-transparent")} aria-hidden />
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const [moreOpen, setMoreOpen] = useState(false);

  const onLogout = async () => {
    await logout.mutateAsync();
    toast.success("Sessão encerrada");
    setMoreOpen(false);
    router.push("/login");
  };

  const moreActive = !NAV_ITEMS.some((i) => MAIN_HREFS.has(i.href) && isActive(pathname, i.href));

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-60 flex-col border-r border-border bg-background px-3 py-6 md:flex">
        <div className="mb-6 px-3">
          <Wordmark />
        </div>
        <Button asChild className="mx-3 mb-6 h-11 justify-start gap-2 text-[15px]">
          <Link href={NEW_PURCHASE_HREF}>
            <Plus aria-hidden />
            nova compra
          </Link>
        </Button>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SideNav pathname={pathname} />
        </div>
        <Button className="mx-3 mt-4" variant="ghost" onClick={onLogout}>
          sair
        </Button>
      </aside>

      <main className="min-h-0 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <TabLink href="/dashboard" label="início" icon={LayoutGrid} active={isActive(pathname, "/dashboard")} />
        <TabLink href="/movements" label="movimentos" icon={CalendarDays} active={isActive(pathname, "/movements")} />
        <div className="flex flex-1 justify-center">
          <Link
            href={NEW_PURCHASE_HREF}
            aria-label="Nova compra"
            className="-mt-5 mb-2 grid size-14 place-items-center bg-foreground text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
        <TabLink href="/purchases" label="compras" icon={ReceiptText} active={isActive(pathname, "/purchases")} />
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-14 flex-1 flex-col items-center justify-center gap-1 text-xs lowercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                moreActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Menu className="size-5" aria-hidden />
              <span className={cn(moreActive && "font-medium")}>mais</span>
              <span className={cn("h-0.5 w-5", moreActive ? "bg-foreground" : "bg-transparent")} aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SideNav pathname={pathname} onNavigate={() => setMoreOpen(false)} skipMain />
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                window.dispatchEvent(new Event(VOICE_OPEN_EVENT));
              }}
              className="mt-px flex w-full items-center gap-3 px-3 py-2.5 text-[15px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Mic className="size-4 shrink-0" aria-hidden />
              comando por voz
            </button>
            <Button className="mt-4 w-full" variant="outline" onClick={onLogout}>
              sair
            </Button>
          </SheetContent>
        </Sheet>
      </nav>

      <VoiceCommandFab />
    </div>
  );
}
