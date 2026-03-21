"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useLogin, useUsers } from "@/shared/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectOptions } from "@/shared/ui/select-options";

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

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.push("/dashboard");
      toast.success("Bem-vindo ao G&M Finance");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar");
    }
  });

  return (
    <Card className="w-full max-w-[420px] shadow-lg">
      <CardHeader className="pb-2 text-center sm:text-left">
        <CardTitle className="text-xl tracking-tight">Entrar</CardTitle>
        <CardDescription className="text-pretty">
          Escolha o usuário e informe o PIN para acessar o painel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="login-user">Usuário</Label>
            <SelectOptions
              id="login-user"
              value={selectedUserId ?? ""}
              onValueChange={(v) => form.setValue("userId", v)}
              options={[
                { value: "", label: "Selecione o usuário" },
                ...(users.data ?? []).map((user) => ({
                  value: user.id,
                  label: user.name,
                })),
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-pin">PIN</Label>
            <Input
              id="login-pin"
              type="password"
              maxLength={8}
              autoComplete="current-password"
              {...form.register("pin")}
            />
          </div>
          <Button className="mt-1 w-full" type="submit" disabled={login.isPending}>
            {login.isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
