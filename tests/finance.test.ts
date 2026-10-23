import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Account,
  Transaction,
  balance,
  totals,
  validate,
  fingerprint,
  parseCSV,
  csv,
  nextDue,
  outstanding,
} from "../lib/finance";
const accounts: Account[] = [
  {
    id: "a",
    name: "Cash",
    type: "Cash",
    opening: 100000,
    currency: "TZS",
    color: "#000",
  },
  {
    id: "b",
    name: "Savings",
    type: "Savings",
    opening: 0,
    currency: "TZS",
    color: "#000",
  },
  {
    id: "usd",
    name: "USD",
    type: "Bank",
    opening: 100,
    currency: "USD",
    color: "#000",
  },
];
const t = (over: Partial<Transaction>): Transaction => ({
  id: "1",
  type: "expense",
  amount: 10000,
  account: "a",
  date: "2026-10-23",
  category: "Other",
  party: "Test",
  notes: "",
  tags: "",
  status: "posted",
  updated: "2026-10-23T00:00:00Z",
  ...over,
});
test("income and expense reconcile account balance", () => {
  const tx = [t({}), t({ id: "2", type: "income", amount: 30000 })];
  assert.equal(balance(accounts[0], tx), 120000);
  assert.deepEqual(totals(tx), { income: 30000, expense: 10000 });
});
test("transfers conserve total and do not inflate reports", () => {
  const tx = [t({ type: "transfer", destination: "b" })];
  assert.equal(balance(accounts[0], tx), 90000);
  assert.equal(balance(accounts[1], tx), 10000);
  assert.deepEqual(totals(tx), { income: 0, expense: 0 });
});
test("refund reverses consumption and restores cash", () => {
  const tx = [t({}), t({ id: "2", type: "refund", amount: 2000 })];
  assert.equal(balance(accounts[0], tx), 92000);
  assert.equal(totals(tx).expense, 8000);
});
test("stale destination cannot credit an unrelated expense", () =>
  assert.equal(balance(accounts[1], [t({ destination: "b" })]), 0));
test("loan principal is excluded and interest is counted once", () => {
  const tx = [
    t({ type: "loan received", amount: 20000 }),
    t({ id: "2", type: "debt repayment", amount: 11000, interest: 1000 }),
  ];
  assert.equal(balance(accounts[0], tx), 109000);
  assert.deepEqual(totals(tx), { income: 0, expense: 1000 });
});
test("receivable repayment credits cash and counts interest only", () => {
  const tx = [
    t({ type: "debt repayment", repaymentDirection: "in", interest: 1000 }),
  ];
  assert.equal(balance(accounts[0], tx), 110000);
  assert.deepEqual(totals(tx), { income: 1000, expense: 0 });
});
test("outstanding debt deducts principal only", () =>
  assert.equal(
    outstanding(
      {
        id: "loan",
        name: "Loan",
        amount: 20000,
        category: "Other",
        date: "2026-12-01",
      },
      [t({ type: "debt repayment", debtId: "loan", interest: 1000 })],
    ),
    11000,
  ));
test("savings contributions and withdrawals are internal", () => {
  const tx = [
    t({ type: "savings contribution", destination: "b", amount: 20000 }),
    t({
      id: "2",
      type: "savings withdrawal",
      account: "b",
      destination: "a",
      amount: 5000,
    }),
  ];
  assert.equal(balance(accounts[0], tx), 85000);
  assert.equal(balance(accounts[1], tx), 15000);
  assert.equal(totals(tx).expense, 0);
});
test("pending and cancelled transactions do not affect balances or budgets", () => {
  const tx = [t({ status: "pending" }), t({ id: "2", status: "cancelled" })];
  assert.equal(balance(accounts[0], tx), 100000);
  assert.equal(totals(tx).expense, 0);
});
test("historical date boundaries are inclusive", () =>
  assert.equal(balance(accounts[0], [t({})], "2026-10-22"), 100000));
test("reject cross-currency transfers, invalid money and dates", () => {
  assert.throws(() =>
    validate(t({ type: "transfer", destination: "usd" }), accounts),
  );
  assert.throws(() => validate(t({ amount: 0.01 }), accounts));
  assert.throws(() => validate(t({ date: "2026-02-30" }), accounts));
  assert.throws(() => validate(t({ interest: -1 }), accounts));
});
test("monthly recurrence clamps month-end and leaps correctly", () => {
  assert.equal(nextDue("2026-01-31", "Monthly"), "2026-02-28");
  assert.equal(nextDue("2028-01-31", "Monthly"), "2028-02-29");
  assert.equal(nextDue("2026-12-29", "Weekly"), "2027-01-05");
});
test("CSV handles quotes, commas and multiline descriptions", () => {
  const rows = [
    ["date", "notes"],
    ["2026-10-23", 'Shop "A",\nDar es Salaam'],
  ];
  assert.deepEqual(parseCSV(csv(rows)), rows);
  assert.throws(() => parseCSV('"unterminated'));
});
test("duplicate imports normalize merchant case and whitespace", () =>
  assert.equal(
    fingerprint(t({ party: " Test " })),
    fingerprint(t({ party: "test" })),
  ));
