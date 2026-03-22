export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Formata número para exibição em input de moeda (pt-BR): "R$ 1.234,56" */
export function formatBRLForInput(value: number): string {
  if (!Number.isFinite(value) || (value === 0 && 1 / value < 0)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Converte string formatada em BRL para número. Aceita "R$ 1.234,56" ou "1234,56". */
export function parseBRLFromInput(str: string): number {
  if (!str || typeof str !== "string") return 0;
  const isNegative = /^-|\s-\s/.test(str.trim());
  const cleaned = str
    .replace(/\s/g, "")
    .replace(/R\$/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  const value = Number.isFinite(parsed) ? parsed : 0;
  return isNegative ? -value : value;
}

export function toInputDate(value: Date) {
  return value.toISOString().split("T")[0] ?? "";
}

/** Formata data ISO (yyyy-MM-dd) para exibição pt-BR: dd/MM/yyyy */
export function formatDisplayDate(isoDate: string): string {
  if (!isoDate || typeof isoDate !== "string") return "";
  const [y, m, d] = isoDate.split("-");
  if (!d || !m || !y) return isoDate;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Mês civil legível a partir de yyyy-MM-dd (ex.: "fevereiro de 2025"). */
export function formatCalendarMonthLabel(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  if (!y || !m) return isoDate;
  const name = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Mês legível a partir de yyyy-MM (ex.: fatura). */
export function formatYearMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const name = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}
