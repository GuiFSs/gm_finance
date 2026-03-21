import { AppShell } from "@/shared/ui/app-shell";
import { requireSession } from "@/shared/lib/server-auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <AppShell>{children}</AppShell>;
}
