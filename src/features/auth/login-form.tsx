"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useLogin, useUsers } from "@/shared/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

const schema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const users = useUsers();
  const login = useLogin();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: "",
      pin: "",
    },
  });
  const selectedUserId = useWatch({ control: form.control, name: "userId" });
  const pin = useWatch({ control: form.control, name: "pin" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar");
    }
  });

  return (
    <div className="w-full max-w-[360px]">
      <h1 className="text-[48px] font-bold lowercase leading-none tracking-[-0.03em] text-foreground">g&amp;m</h1>
      <p className="mt-2 text-[15px] lowercase text-muted-foreground">gestão da casa</p>

      <form className="mt-10 space-y-6" onSubmit={onSubmit}>
        <fieldset>
          <legend className="pb-2 text-[15px] text-muted-foreground">quem é</legend>
          {users.isLoading ? (
            <div className="grid grid-cols-2 gap-[3px]">
              <div className="h-14 animate-pulse bg-muted" />
              <div className="h-14 animate-pulse bg-muted" />
            </div>
          ) : users.isError ? (
            <p className="text-[15px] text-ink-out">Não foi possível carregar os usuários. Recarregue a página.</p>
          ) : (
            <ToggleGroup
              type="single"
              value={selectedUserId}
              onValueChange={(v) => v && form.setValue("userId", v)}
              aria-label="Usuário"
              className="grid grid-cols-2 gap-[3px]"
            >
              {(users.data ?? []).map((user) => (
                <ToggleGroupItem
                  key={user.id}
                  value={user.id}
                  className="h-14 border border-input text-[15px] lowercase data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
                >
                  {user.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="login-pin" className="block text-[15px] text-muted-foreground">
            pin
          </label>
          <Input
            id="login-pin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoComplete="current-password"
            className="h-14 text-2xl tracking-[0.3em]"
            {...form.register("pin")}
          />
        </div>

        <Button className="h-12 w-full" type="submit" disabled={login.isPending || !selectedUserId || !pin}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
