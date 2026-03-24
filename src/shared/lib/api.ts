import { ZodSchema } from "zod";

/** Mensagem legível para o cliente, incluindo causa encadeada (ex.: Drizzle + SQLite). */
export function errorMessageForClient(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts: string[] = [error.message];
  let c: unknown = error.cause;
  for (let depth = 0; depth < 5 && c instanceof Error; depth++) {
    if (c.message) parts.push(c.message);
    c = c.cause;
  }
  const combined = parts.join(" · ");
  if (/no such table/i.test(combined)) {
    return "Banco de dados desatualizado: execute npm run db:migrate e reinicie o app.";
  }
  return combined;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function parseBody<T>(schema: ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(", "));
  }
  return parsed.data;
}
