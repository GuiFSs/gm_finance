import type { ParsedVoiceCommand } from "@/shared/lib/gemini-parse-voice-command";
import { formatCurrency } from "@/shared/utils/formatters";

type Named = { id: string; name: string };

export function voiceCommandTitle(command: ParsedVoiceCommand): string {
  switch (command.intent) {
    case "create_pocket":
      return "Criar caixinha";
    case "set_pocket_balance":
      return "Atualizar caixinha";
    case "create_deposit":
      return "Novo depósito";
    case "create_purchase":
      return "Nova despesa";
    case "unknown":
      return "Não entendi";
  }
}

export function voiceCommandSummary(
  command: ParsedVoiceCommand,
  lookups?: { pockets?: Named[]; cards?: Named[]; categories?: Named[] },
): string {
  switch (command.intent) {
    case "create_pocket": {
      const parts = [`Criar caixinha “${command.name}”`];
      if (command.initialAmount > 0) {
        parts.push(`com saldo inicial de ${formatCurrency(command.initialAmount)}`);
      }
      if (command.description) {
        parts.push(`(${command.description})`);
      }
      return parts.join(" ");
    }
    case "set_pocket_balance": {
      const parts: string[] = [`Caixinha “${command.pocketName}”`];
      const delta = command.balanceDelta;
      if (Math.abs(delta) > 1e-6) {
        parts.push(
          `saldo para ${formatCurrency(command.newBalance)} (hoje ${formatCurrency(command.currentBalance)}; ajuste de ${formatCurrency(delta)})`,
        );
      } else if (command.newDescription == null) {
        parts.push("sem alteração de saldo");
      }
      if (command.newDescription != null) {
        parts.push(
          command.newDescription
            ? `descrição: “${command.newDescription}”`
            : "remover descrição",
        );
      }
      return parts.join(" — ");
    }
    case "create_deposit": {
      const dest =
        command.targetType === "pocket" && command.pocketName
          ? `na caixinha “${command.pocketName}”`
          : "na conta corrente";
      return `Registrar depósito “${command.title}” de ${formatCurrency(command.amount)} ${dest} em ${command.depositDate}`;
    }
    case "create_purchase": {
      const p = command.purchase;
      const amountText =
        p.amount != null && p.amount > 0 ? formatCurrency(p.amount) : "valor a completar";
      let source = "conta corrente";
      if (p.paymentSourceType === "pocket") {
        const name = lookups?.pockets?.find((x) => x.id === p.paymentSourceId)?.name;
        source = name ? `caixinha “${name}”` : "caixinha";
      } else if (p.paymentSourceType === "card") {
        const name = lookups?.cards?.find((x) => x.id === p.paymentSourceId)?.name;
        source = name ? `cartão “${name}”` : "cartão";
      }
      const installments =
        p.installmentCount > 1 ? `, ${p.installmentCount}x` : "";
      const cat = p.categoryId
        ? lookups?.categories?.find((c) => c.id === p.categoryId)?.name
        : null;
      const catText = cat ? `; categoria ${cat}` : "";
      return `Registrar despesa “${p.title}” de ${amountText} em ${p.purchaseDate} via ${source}${installments}${catText}`;
    }
    case "unknown":
      return command.message;
  }
}

export function voiceCommandCanExecute(command: ParsedVoiceCommand): boolean {
  if (command.intent === "unknown") return false;
  if (command.intent === "create_purchase") {
    return command.purchase.amount != null && command.purchase.amount > 0;
  }
  if (command.intent === "set_pocket_balance") {
    return Math.abs(command.balanceDelta) > 1e-6 || command.newDescription != null;
  }
  return true;
}
