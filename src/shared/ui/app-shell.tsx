"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Landmark,
  LayoutDashboard,
  Menu,
  PiggyBank,
  ReceiptText,
  Repeat,
  Target,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/cn";
import { useLogout } from "@/shared/hooks/use-auth";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/shared/ui/sheet";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/movements", label: "Movimentos do mês", icon: CalendarDays },
  { href: "/purchases", label: "Compras", icon: ReceiptText },
  { href: "/pockets", label: "Caixinhas", icon: PiggyBank },
  { href: "/cards", label: "Cartões", icon: WalletCards },
  { href: "/recurring", label: "Recorrentes", icon: Repeat },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/deposits", label: "Depósitos", icon: Landmark },
];

function AppNav({
  pathname,
  onNavigate,
  className,
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-1", className)}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm md:py-2",
              active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="min-w-0 leading-snug">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const onLogout = async () => {
    await logout.mutateAsync();
    toast.success("Sessão encerrada");
    setMobileNavOpen(false);
    router.push("/login");
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-900 md:hidden">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[min(100vw-1rem,18rem)] flex-col gap-0 p-0 sm:max-w-sm">
            <div className="border-b border-border px-4 py-4">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">G&M Finance</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gestão da casa</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <AppNav pathname={pathname} onNavigate={closeMobileNav} />
            </div>
            <div className="border-t border-border p-4">
              <Button className="w-full" variant="outline" onClick={onLogout}>
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">G&M Finance</p>
        </div>
      </header>

      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-64 flex-col border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:flex">
        <div className="mb-8 shrink-0">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">G&M Finance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gestão da casa</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AppNav pathname={pathname} />
        </div>

        <Button className="mt-4 w-full shrink-0" variant="outline" onClick={onLogout}>
          Sair
        </Button>
      </aside>

      <main className="min-h-0 p-4 pb-8 sm:p-6 md:ml-64 md:pb-6">{children}</main>
    </div>
  );
}
