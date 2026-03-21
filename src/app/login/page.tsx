import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getSessionFromCookies } from "@/shared/lib/auth";

export default async function LoginPage() {
  const session = await getSessionFromCookies();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
      <LoginForm />
    </div>
  );
}
