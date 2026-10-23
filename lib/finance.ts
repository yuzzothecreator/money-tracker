import { z } from "zod";
export const types = [
  "expense",
  "income",
  "transfer",
  "refund",
  "loan given",
  "loan received",
  "debt repayment",
  "savings contribution",
  "savings withdrawal",
  "adjustment",
] as const;
export type Kind = (typeof types)[number];
export type Account = {
  id: string;
  name: string;
  type: string;
  opening: number;
  currency: string;
  color: string;
  archived?: boolean;
};
export type Transaction = {
  id: string;
  type: Kind;
  amount: number;
  account: string;
  destination?: string;
  category: string;
  party: string;
  notes: string;
  date: string;
  status: "posted" | "pending" | "cancelled";
  tags: string;
  updated: string;
  interest?: number;
  debtId?: string;
  repaymentDirection?: "in" | "out";
  scheduleId?: string;
  scheduledDate?: string;
};
export type Plan = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  account?: string;
  direction?: string;
  frequency?: string;
  paused?: boolean;
  start?: string;
  end?: string;
};
export type Data = {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Plan[];
  goals: Plan[];
  debts: Plan[];
  recurring: Plan[];
  categories: string[];
  audit: { date: string; action: string }[];
};
export const categories = [
  "Food & groceries",
  "Transport",
  "Housing",
  "Utilities",
  "Airtime & data",
  "Shopping",
  "Health",
  "Education",
  "Family support",
  "Entertainment",
  "Personal care",
  "Business",
  "Fees",
  "Salary",
  "Freelance",
  "Gifts",
  "Other",
];
export const empty: Data = {
  accounts: [],
  transactions: [],
  budgets: [],
  goals: [],
  debts: [],
  recurring: [],
  categories,
  audit: [],
};
export const amountSchema = z.coerce
  .number()
  .positive()
  .max(900000000000)
  .refine(Number.isSafeInteger, "Use whole shillings");
export function validate(t: Transaction, accounts: Account[]) {
  amountSchema.parse(t.amount);
  if (!types.includes(t.type)) throw Error("Invalid transaction type");
  if (!["posted", "pending", "cancelled"].includes(t.status))
    throw Error("Invalid status");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
    !Number.isFinite(Date.parse(t.date)) ||
    new Date(t.date).toISOString().slice(0, 10) !== t.date
  )
    throw Error("Invalid transaction date");
  const a = accounts.find((a) => a.id === t.account);
  if (!a) throw Error("Choose an account");
  if (
    ["transfer", "savings contribution", "savings withdrawal"].includes(t.type)
  ) {
    const b = accounts.find((a) => a.id === t.destination);
    if (!b || b.id === a.id)
      throw Error("Choose a different destination account");
    if (a.currency !== b.currency)
      throw Error(
        "Cross-currency transfers require an exchange rate and are not supported yet",
      );
  }
  if (
    !Number.isSafeInteger(t.interest || 0) ||
    (t.interest || 0) < 0 ||
    (t.interest || 0) > t.amount
  )
    throw Error("Interest must be between zero and the repayment total");
}
export const linked = (t: Transaction) =>
  ["transfer", "savings contribution", "savings withdrawal"].includes(t.type);
export function balance(a: Account, tx: Transaction[], until = "9999") {
  return tx
    .filter((t) => t.status === "posted" && t.date <= until)
    .reduce((sum, t) => {
      let delta = 0;
      if (t.account === a.id)
        delta =
          ["income", "refund", "loan received", "adjustment"].includes(
            t.type,
          ) ||
          (t.type === "debt repayment" && t.repaymentDirection === "in")
            ? t.amount
            : -t.amount;
      if (linked(t) && t.destination === a.id) delta += t.amount;
      return sum + delta;
    }, a.opening);
}
export function totals(tx: Transaction[]) {
  return tx
    .filter((t) => t.status === "posted")
    .reduce(
      (s, t) => ({
        income:
          s.income +
          (t.type === "income"
            ? t.amount
            : t.type === "debt repayment" && t.repaymentDirection === "in"
              ? t.interest || 0
              : 0),
        expense:
          s.expense +
          (t.type === "expense"
            ? t.amount
            : t.type === "refund"
              ? -t.amount
              : t.type === "debt repayment" && t.repaymentDirection !== "in"
                ? t.interest || 0
                : 0),
      }),
      { income: 0, expense: 0 },
    );
}
export function outstanding(p: Plan, tx: Transaction[]) {
  return Math.max(
    0,
    p.amount -
      tx
        .filter(
          (t) =>
            t.debtId === p.id &&
            t.type === "debt repayment" &&
            t.status === "posted",
        )
        .reduce((s, t) => s + t.amount - (t.interest || 0), 0),
  );
}
export function nextDue(date: string, frequency: string) {
  const d = new Date(date + "T12:00:00Z");
  if (["Daily", "Weekly", "Fortnightly"].includes(frequency))
    d.setUTCDate(
      d.getUTCDate() +
        ({ Daily: 1, Weekly: 7, Fortnightly: 14 }[frequency] || 1),
    );
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(
      d.getUTCMonth() +
        ({ Monthly: 1, Quarterly: 3, Annually: 12 }[frequency] || 1),
    );
    const end = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, end));
  }
  return d.toISOString().slice(0, 10);
}
export const money = (v: number, c = "TZS", locale = "en-TZ") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: c,
    maximumFractionDigits: 0,
  }).format(v);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function fingerprint(
  t: Pick<Transaction, "date" | "amount" | "account" | "type" | "party">,
) {
  return [
    t.date,
    t.amount,
    t.account,
    t.type,
    t.party.trim().toLowerCase(),
  ].join("|");
}
export function csv(rows: string[][]) {
  return rows
    .map((r) =>
      r.map((c) => '"' + String(c).replaceAll('"', '""') + '"').join(","),
    )
    .join("\r\n");
}
export function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
