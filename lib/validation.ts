import { z } from "zod";
import { types, validate, Data } from "./finance";
const id = z.uuid(),
  text = z.string().max(500),
  amount = z.number().int().nonnegative().max(900000000000),
  date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const plan = z.object({
  id,
  name: text.min(1),
  amount: amount.positive(),
  category: text,
  date,
  account: id.optional(),
  direction: z.enum(["lent", "borrowed"]).optional(),
  frequency: z
    .enum([
      "Daily",
      "Weekly",
      "Fortnightly",
      "Monthly",
      "Quarterly",
      "Annually",
    ])
    .optional(),
  paused: z.boolean().optional(),
  start: date.optional(),
  end: date.optional(),
});
export const workspaceSchema = z
  .object({
    accounts: z
      .array(
        z.object({
          id,
          name: text.min(1),
          type: text,
          opening: z.number().int().min(-900000000000).max(900000000000),
          currency: z.string().regex(/^[A-Z]{3}$/),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          archived: z.boolean().optional(),
        }),
      )
      .max(100),
    transactions: z
      .array(
        z.object({
          id,
          type: z.enum(types),
          amount: amount.positive(),
          account: id,
          destination: id.optional(),
          category: text,
          party: text,
          notes: z.string().max(5000),
          date,
          status: z.enum(["posted", "pending", "cancelled"]),
          tags: text,
          updated: z.iso.datetime(),
          interest: amount.optional(),
          debtId: id.optional(),
          repaymentDirection: z.enum(["in", "out"]).optional(),
          scheduleId: id.optional(),
          scheduledDate: date.optional(),
        }),
      )
      .max(20000),
    budgets: z.array(plan).max(500),
    goals: z.array(plan).max(500),
    debts: z.array(plan).max(500),
    recurring: z.array(plan).max(500),
    categories: z.array(text.min(1)).max(500),
    audit: z
      .array(z.object({ date: z.iso.datetime(), action: text }))
      .max(1000),
  })
  .superRefine((d, ctx) => {
    const ids = d.accounts.map((a) => a.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Duplicate account ID" });
    if (new Set(d.transactions.map((t) => t.id)).size !== d.transactions.length)
      ctx.addIssue({ code: "custom", message: "Duplicate transaction ID" });
    d.transactions.forEach((t) => {
      try {
        validate(t, d.accounts);
      } catch (e) {
        ctx.addIssue({
          code: "custom",
          message: e instanceof Error ? e.message : "Invalid transaction",
        });
      }
    });
    const allPlans = [...d.budgets, ...d.goals, ...d.debts, ...d.recurring];
    if (new Set(allPlans.map((p) => p.id)).size !== allPlans.length)
      ctx.addIssue({ code: "custom", message: "Duplicate plan ID" });
    allPlans.forEach((p) => {
      if (p.account && !ids.includes(p.account))
        ctx.addIssue({
          code: "custom",
          message: "Planning account is missing",
        });
      if (p.start && p.end && p.start > p.end)
        ctx.addIssue({ code: "custom", message: "Invalid budget period" });
    });
    const allocated = d.goals.map((g) => g.account).filter(Boolean);
    if (new Set(allocated).size !== allocated.length)
      ctx.addIssue({
        code: "custom",
        message: "An account cannot fund multiple goals",
      });
    d.transactions.forEach((t) => {
      if (t.debtId && !d.debts.some((p) => p.id === t.debtId))
        ctx.addIssue({
          code: "custom",
          message: "Repayment agreement is missing",
        });
    });
  });
export function validateWorkspace(value: unknown): Data {
  return workspaceSchema.parse(value);
}
