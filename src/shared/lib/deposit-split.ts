/** Tolerância para comparar soma de partes com valor total (centavos). */
export const DEPOSIT_SUM_EPS = 0.02;

/** Tolerância para soma de percentuais em depósitos recorrentes. */
export const PERCENT_SUM_EPS = 0.05;

/** Distribui o total em partes proporcionais aos percentuais (soma dos percentuais deve ser 100). */
export function distributeAmountsByPercent(total: number, percents: number[]): number[] {
  if (percents.length === 0) return [];
  const n = percents.length;
  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    const v = Number(((total * (percents[i] ?? 0)) / 100).toFixed(2));
    out.push(v);
    allocated += v;
  }
  out.push(Number((total - allocated).toFixed(2)));
  return out;
}

/** Converte valores absolutos em percentuais que somam 100 (útil ao salvar depósito recorrente em modo valor). */
export function amountsToPercents(total: number, amounts: number[]): number[] {
  if (total <= 0 || amounts.length === 0) return [];
  const n = amounts.length;
  const raw: number[] = [];
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    const p = Number((((amounts[i] ?? 0) / total) * 100).toFixed(2));
    raw.push(p);
    sum += p;
  }
  raw.push(Number((100 - sum).toFixed(2)));
  return raw;
}
