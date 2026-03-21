"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, PiggyBank, WalletCards, ReceiptText, Repeat, Target, Landmark, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/cn";
import { useLogout } from "@/shared/hooks/use-auth";
import { Button } from "@/shared/ui/button";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  const onLogout = async () => {
    await logout.mutateAsync();
    toast.success("Sessão encerrada");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">G&M Finance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gestão da casa</p>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button className="mt-8 w-full" variant="outline" onClick={onLogout}>
          Sair
        </Button>
      </aside>

      <main className="ml-64 p-6">{children}</main>
    </div>
  );
}
