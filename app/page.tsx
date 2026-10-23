"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Wallet,
  ReceiptText,
  ChartNoAxesCombined,
  Target,
  CalendarDays,
  Settings,
  LogOut,
  Bell,
  HelpCircle,
  Download,
  Upload,
  X,
  Check,
  Sun,
  Moon,
  Menu,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Landmark,
  Smartphone,
  Banknote,
  WifiOff,
  ShieldCheck,
  SlidersHorizontal,
  Pencil,
  Trash2,
  Repeat,
  HandCoins,
  Tags,
  CloudOff,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Account,
  Transaction,
  Plan,
  Data,
  empty,
  types,
  Kind,
  balance,
  totals,
  money as formatMoney,
  today,
  validate,
  csv,
  parseCSV,
  fingerprint,
  amountSchema,
  outstanding,
  nextDue,
} from "../lib/finance";
import { db } from "../lib/store";
import { useLanguage, LanguageToggle } from "./language";
import AuthForm from "./auth-form";
import CloudSync from "./cloud-sync";
import { validateWorkspace } from "../lib/validation";
const nav = [
  ["Overview", LayoutDashboard],
  ["Transactions", ReceiptText],
  ["Accounts", Wallet],
  ["Budgets", ChartNoAxesCombined],
  ["Savings goals", Target],
  ["Loans & debts", HandCoins],
  ["Recurring", Repeat],
  ["Calendar", CalendarDays],
  ["Reports", ChartNoAxesCombined],
] as const;
const palette = [
  "#6254e8",
  "#f4a94a",
  "#50b9a6",
  "#ed7c93",
  "#8aa5e3",
  "#b79bd5",
];
const uid = () => crypto.randomUUID();
const initialTx = (): Transaction => ({
  id: uid(),
  type: "expense",
  amount: 0,
  account: "",
  category: "Food & groceries",
  party: "",
  notes: "",
  date: today(),
  status: "posted",
  tags: "",
  updated: new Date().toISOString(),
});
function download(name: string, text: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
export default function Page() {
  const { tr, language, locale, setLanguage } = useLanguage();
  const money = (value: number, currency = "TZS") =>
    formatMoney(value, currency, locale);
  const revision = useRef(0);
  const [data, setData] = useState<Data>(empty),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Overview"),
    [modal, setModal] = useState<string | null>(null),
    [theme, setTheme] = useState("light"),
    [period, setPeriod] = useState("This month"),
    [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [account, setAccount] = useState("all"),
    [category, setCategory] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [tx, setTx] = useState<Transaction>(initialTx),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [online, setOnline] = useState(true),
    [collapsed, setCollapsed] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [pagination, setPagination] = useState(0),
    [sort, setSort] = useState("newest"),
    [form, setForm] = useState<Record<string, string>>({}),
    [importRows, setImportRows] = useState<string[][]>([]),
    [mapping, setMapping] = useState({
      date: 0,
      type: 1,
      amount: 2,
      account: 3,
      category: 4,
      party: 5,
      notes: 6,
    }),
    [profile, setProfile] = useState("My workspace");
  useEffect(() => {
    db.state
      .get("local")
      .then((r) => {
        if (r) {
          setData(r.data);
          revision.current = r.revision || 0;
        }
        setReady(true);
      })
      .catch(() =>
        setError(
          "Local database could not be opened. Your browser must allow IndexedDB.",
        ),
      );
    setTheme(localStorage.getItem("mf-theme") || "light");
    setProfile(localStorage.getItem("mf-profile") || "My workspace");
    setOnline(navigator.onLine);
    if (new URLSearchParams(location.search).get("auth")) setModal("auth");
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
      if (event.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] button:not(:disabled),[role="dialog"] input:not(:disabled):not([type="file"]),[role="dialog"] select:not(:disabled),[role="dialog"] textarea',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function commit(next: Data, action: string) {
    const updated = {
      ...next,
      audit: [{ date: new Date().toISOString(), action }, ...next.audit].slice(
        0,
        1000,
      ),
    };
    try {
      const expected = revision.current;
      await db.transaction("rw", db.state, async () => {
        const prior = await db.state.get("local");
        if ((prior?.revision || 0) !== expected)
          throw Error("Data changed in another tab. Reload before saving.");
        await db.state.put({
          id: "local",
          data: updated,
          revision: expected + 1,
        });
      });
      revision.current = expected + 1;
      setData(updated);
      setToast(action);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Check available storage.",
      );
      throw e;
    }
  }
  function changeTheme(value: string) {
    localStorage.setItem("mf-theme", value);
    setTheme(value);
  }
  function open(name: string) {
    setError("");
    setForm({
      currency: "TZS",
      type: "Mobile money",
      color: palette[0],
      date: today(),
      category: data.categories[0],
      frequency: "Monthly",
      direction: "borrowed",
      start: today().slice(0, 7) + "-01",
      end: new Date(
        Number(today().slice(0, 4)),
        Number(today().slice(5, 7)),
        0,
      ).toLocaleDateString("en-CA"),
    });
    setModal(name);
  }
  function addTx() {
    setTx({
      ...initialTx(),
      account: data.accounts.find((a) => !a.archived)?.id || "",
    });
    open("transaction");
  }
  const now = today(),
    month = now.slice(0, 7);
  const range = useMemo(() => {
    const d = new Date(now + "T12:00:00Z");
    let start = month + "-01",
      end = now;
    if (period === "Today") start = now;
    if (period === "This week") {
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      start = d.toISOString().slice(0, 10);
    }
    if (period === "This year") start = now.slice(0, 4) + "-01-01";
    if (period === "All time") start = "0000";
    if (period === "Custom") {
      start = from || "0000";
      end = to || "9999";
    }
    return { start, end };
  }, [period, from, to, now, month]);
  const periodTx = data.transactions.filter(
    (t) => t.date >= range.start && t.date <= range.end,
  );
  const reportTx = periodTx.filter(
    (t) => data.accounts.find((a) => a.id === t.account)?.currency === "TZS",
  );
  const summary = totals(reportTx),
    tzAccounts = data.accounts.filter((a) => a.currency === "TZS"),
    total = tzAccounts.reduce((s, a) => s + balance(a, data.transactions), 0);
  const filtered = periodTx
    .filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (account === "all" ||
          t.account === account ||
          t.destination === account) &&
        (category === "all" || t.category === category) &&
        [t.party, t.notes, t.category, t.tags, t.amount]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "amount"
        ? b.amount - a.amount
        : sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  const spending = data.categories
    .map((name, i) => ({
      name,
      value: Math.max(
        0,
        totals(reportTx.filter((t) => t.category === name)).expense,
      ),
      color: palette[i % palette.length],
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const chart = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - (11 - i) * 3);
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      label: d.toLocaleDateString(locale, { day: "numeric", month: "short" }),
      balance: tzAccounts.reduce(
        (s, a) => s + balance(a, data.transactions, date),
        0,
      ),
    };
  });
  const due = data.recurring
    .filter((r) => !r.paused && r.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const obligations = data.debts
    .filter((d) => d.direction === "borrowed")
    .reduce((s, d) => s + outstanding(d, data.transactions), 0);
  const safe = Math.max(
    0,
    total - due.reduce((s, d) => s + outstanding(d, data.transactions), 0),
  );
  function go(p: string) {
    setPage(p);
    setQuery("");
    setType("all");
    setAccount("all");
    setCategory("all");
    setPagination(0);
  }
  function drill(kind: string) {
    go("Transactions");
    setType(kind);
  }
  async function saveTransaction(e: React.FormEvent) {
    e.preventDefault();
    try {
      validate(tx, data.accounts);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date))
        throw Error("Choose a valid date");
      const exists = data.transactions.some((t) => t.id === tx.id);
      if (tx.debtId) {
        const debt = data.debts.find((d) => d.id === tx.debtId);
        if (!debt) throw Error("Loan agreement is missing");
        if (
          tx.amount - (tx.interest || 0) >
          outstanding(
            debt,
            data.transactions.filter((t) => t.id !== tx.id),
          )
        )
          throw Error("Principal exceeds outstanding debt");
      }
      if (
        tx.scheduleId &&
        data.transactions.some(
          (t) =>
            t.id !== tx.id &&
            t.scheduleId === tx.scheduleId &&
            t.scheduledDate === tx.scheduledDate &&
            t.status === "posted",
        )
      )
        throw Error("This scheduled payment has already been recorded");
      await commit(
        {
          ...data,
          recurring: data.recurring.map((r) =>
            r.id === tx.scheduleId &&
            r.date === tx.scheduledDate &&
            tx.status === "posted"
              ? { ...r, date: nextDue(r.date, r.frequency || "Monthly") }
              : r,
          ),
          transactions: [
            { ...tx, updated: new Date().toISOString() },
            ...data.transactions.filter((t) => t.id !== tx.id),
          ],
        },
        exists ? "Transaction updated" : "Transaction recorded",
      );
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid transaction");
    }
  }
  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!form.name?.trim()) throw Error("Enter a name");
      if (modal === "account") {
        const opening = Number(form.amount || 0);
        if (!Number.isSafeInteger(opening))
          throw Error("Enter a whole-shilling opening balance");
        const existing = data.accounts.find((a) => a.id === form.id);
        if (
          existing &&
          existing.currency !== form.currency &&
          data.transactions.some(
            (t) => t.account === existing.id || t.destination === existing.id,
          )
        )
          throw Error(
            "Currency cannot be changed after recording transactions",
          );
        await commit(
          {
            ...data,
            accounts: [
              ...data.accounts.filter((a) => a.id !== form.id),
              {
                ...existing,
                id: form.id || uid(),
                name: form.name,
                type: form.type,
                opening,
                currency: form.currency || "TZS",
                color: form.color || palette[0],
              },
            ],
          },
          form.id ? "Account updated" : "Account created",
        );
      } else if (modal === "category") {
        if (data.categories.includes(form.name))
          throw Error("Category already exists");
        await commit(
          { ...data, categories: [...data.categories, form.name] },
          "Category created",
        );
      } else {
        const amount = amountSchema.parse(form.amount);
        if (modal === "debt" && form.id) {
          const prior = data.debts.find((d) => d.id === form.id);
          if (
            prior &&
            amount < prior.amount - outstanding(prior, data.transactions)
          )
            throw Error(
              "Principal cannot be less than repayments already recorded",
            );
        }
        if (
          modal === "budget" &&
          (!form.start || !form.end || form.start > form.end)
        )
          throw Error("Choose a valid budget period");
        if (
          modal === "goal" &&
          data.goals.some((g) => g.account === form.account && g.id !== form.id)
        )
          throw Error("This account is already allocated to another goal");
        if (
          (modal === "goal" || modal === "recurring") &&
          data.accounts.find((a) => a.id === form.account)?.currency !== "TZS"
        )
          throw Error("Planning currently supports TZS accounts only");
        const key =
          modal === "budget"
            ? "budgets"
            : modal === "goal"
              ? "goals"
              : modal === "debt"
                ? "debts"
                : "recurring";
        await commit(
          {
            ...data,
            [key]: [
              ...data[key].filter((p) => p.id !== form.id),
              {
                ...data[key].find((p) => p.id === form.id),
                ...form,
                id: form.id || uid(),
                name: form.name,
                amount,
                category: form.category || "Other",
                date: form.date || today(),
              },
            ],
          },
          `${modal} ${form.id ? "updated" : "created"}`,
        );
      }
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the form");
    }
  }
  async function removeTransaction(id: string) {
    if (
      confirm(
        tr("Delete this transaction? Its balance effect will be reversed."),
      )
    ) {
      await commit(
        { ...data, transactions: data.transactions.filter((t) => t.id !== id) },
        "Transaction deleted",
      );
      setModal(null);
    }
  }
  function exportCSV() {
    download(
      "moneyflow-transactions.csv",
      csv([
        [
          "date",
          "type",
          "amount",
          "account",
          "category",
          "party",
          "notes",
          "status",
          "tags",
        ],
        ...filtered.map((t) => [
          t.date,
          t.type,
          String(t.amount),
          data.accounts.find((a) => a.id === t.account)?.name || "",
          t.category,
          t.party,
          t.notes,
          t.status,
          t.tags,
        ]),
      ]),
    );
  }
  function table(list: Transaction[], compact = false) {
    return list.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {!compact && (
                <th>
                  <input
                    aria-label={tr("Select all transactions")}
                    type="checkbox"
                    checked={list.every((t) => selected.includes(t.id))}
                    onChange={(e) =>
                      setSelected(e.target.checked ? list.map((t) => t.id) : [])
                    }
                  />
                </th>
              )}
              <th>{tr("Transaction")}</th>
              <th>{tr("Category")}</th>
              <th>{tr("Date")}</th>
              {!compact && <th>{tr("Account")}</th>}
              <th className="align-right">{tr("Amount")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                {!compact && (
                  <td>
                    <input
                      aria-label={`Select ${t.party || t.category}`}
                      type="checkbox"
                      checked={selected.includes(t.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, t.id]
                            : selected.filter((id) => id !== t.id),
                        )
                      }
                    />
                  </td>
                )}
                <td>
                  <button
                    className="transaction-name"
                    onClick={() => {
                      setTx(t);
                      open("detail");
                    }}
                  >
                    <span
                      className={
                        "transaction-icon " +
                        (t.type === "income" || t.type === "refund"
                          ? "green"
                          : t.type === "expense"
                            ? "lavender"
                            : "blue")
                      }
                    >
                      {t.type === "income" || t.type === "refund" ? (
                        <ArrowDownLeft size={18} />
                      ) : t.type === "expense" ? (
                        <ReceiptText size={18} />
                      ) : (
                        <ArrowLeftRight size={18} />
                      )}
                    </span>
                    <span>
                      <strong>{t.party || t.category}</strong>
                      <small>
                        {tr(t.type)}
                        {tr(t.status !== "posted" ? ` · ${t.status}` : "")}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="tag">{tr(t.category)}</span>
                </td>
                <td className="muted">
                  {new Date(t.date + "T12:00:00").toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                {!compact && (
                  <td className="muted">
                    {data.accounts.find((a) => a.id === t.account)?.name}
                  </td>
                )}
                <td
                  className={
                    "align-right amount " +
                    (["income", "refund"].includes(t.type) ? "positive" : "")
                  }
                >
                  {tr(
                    [
                      "income",
                      "refund",
                      "loan received",
                      "adjustment",
                    ].includes(t.type)
                      ? "+"
                      : "−",
                  )}
                  {money(
                    t.amount,
                    data.accounts.find((a) => a.id === t.account)?.currency,
                  )}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={tr("Transaction details")}
                    onClick={() => {
                      setTx(t);
                      open("detail");
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty">
        <ReceiptText size={30} />
        <h3>{tr("Your story starts with a transaction")}</h3>
        <p>{tr("Record money in or out to see your finances take shape.")}</p>
        <button className="text-button" onClick={addTx}>
          {tr("Add your first transaction ")}
          <ArrowRight size={15} />
        </button>
      </div>
    );
  }
  function planCards(key: "budgets" | "goals" | "debts" | "recurring") {
    return (
      <div className="plan-grid">
        {data[key].map((p) => {
          const actual =
            key === "budgets"
              ? totals(
                  data.transactions.filter(
                    (t) =>
                      data.accounts.find((a) => a.id === t.account)
                        ?.currency === "TZS" &&
                      t.date >= (p.start || range.start) &&
                      t.date <= (p.end || range.end) &&
                      (p.category === "All categories" ||
                        t.category === p.category),
                  ),
                ).expense
              : key === "goals"
                ? data.transactions
                    .filter(
                      (t) =>
                        t.type === "savings contribution" &&
                        t.destination === p.account &&
                        t.status === "posted",
                    )
                    .reduce((s, t) => s + t.amount, 0) -
                  data.transactions
                    .filter(
                      (t) =>
                        t.type === "savings withdrawal" &&
                        t.account === p.account &&
                        t.status === "posted",
                    )
                    .reduce((s, t) => s + t.amount, 0)
                : 0;
          return (
            <article className="panel plan-card" key={p.id}>
              <div className="section-heading">
                <span className="square-icon">
                  <Target size={20} />
                </span>
                <button
                  className="icon-button"
                  aria-label={tr("Edit plan")}
                  onClick={() => {
                    open(
                      key === "budgets"
                        ? "budget"
                        : key === "goals"
                          ? "goal"
                          : key === "debts"
                            ? "debt"
                            : "recurring",
                    );
                    setForm({
                      id: p.id,
                      name: p.name,
                      amount: String(p.amount),
                      category: p.category,
                      date: p.date,
                      ...(p.account ? { account: p.account } : {}),
                      direction: p.direction || "borrowed",
                      frequency: p.frequency || "Monthly",
                      ...(key === "budgets"
                        ? {
                            start: p.start || today().slice(0, 7) + "-01",
                            end: p.end || today(),
                          }
                        : {}),
                    });
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  aria-label={tr("Delete plan")}
                  className="icon-button"
                  onClick={() => {
                    if (
                      key === "debts" &&
                      data.transactions.some((t) => t.debtId === p.id)
                    ) {
                      setToast(
                        "This agreement has repayments. Keep it to preserve principal history.",
                      );
                      return;
                    }
                    if (
                      confirm(
                        tr(
                          "Delete this plan? Financial transactions are retained.",
                        ),
                      )
                    )
                      void commit(
                        {
                          ...data,
                          [key]: data[key].filter((x) => x.id !== p.id),
                        },
                        "Plan deleted",
                      );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3>{p.name}</h3>
              <p className="muted">
                {tr(
                  key === "debts"
                    ? p.direction === "lent"
                      ? "Money owed to you"
                      : "Money you owe"
                    : key === "recurring"
                      ? `${p.frequency} · next due ${p.date}`
                      : p.category,
                )}
              </p>
              <h2>
                {money(
                  key === "budgets" || key === "goals"
                    ? actual
                    : key === "debts"
                      ? outstanding(p, data.transactions)
                      : p.amount,
                )}{" "}
                <small>
                  {(key === "budgets" || key === "goals") &&
                    `/ ${money(p.amount)}`}
                </small>
              </h2>
              {(key === "budgets" || key === "goals") && (
                <>
                  <div className="progress">
                    <i
                      style={{
                        width: `${Math.min(100, Math.max(0, (actual / p.amount) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="muted">
                    {money(Math.max(0, p.amount - actual))}
                    {tr(" remaining ·")} {Math.round((actual / p.amount) * 100)}
                    %
                  </p>
                </>
              )}
              <p className="muted">
                {tr(
                  key === "budgets"
                    ? `${p.start || range.start} to ${p.end || range.end}`
                    : `Target / due date: ${p.date}`,
                )}
              </p>
              {key === "recurring" && (
                <button
                  className="secondary"
                  disabled={p.paused}
                  onClick={() => {
                    setTx({
                      ...initialTx(),
                      party: p.name,
                      amount: p.amount,
                      scheduleId: p.id,
                      scheduledDate: p.date,
                      category: p.category,
                      account: p.account || data.accounts[0]?.id || "",
                    });
                    open("transaction");
                  }}
                >
                  {tr(p.paused ? "Schedule paused" : "Record payment")}{" "}
                  <ArrowRight size={14} />
                </button>
              )}
              {key === "recurring" && (
                <button
                  className="text-button"
                  style={{ marginLeft: 12 }}
                  onClick={() =>
                    void commit(
                      {
                        ...data,
                        recurring: data.recurring.map((r) =>
                          r.id === p.id ? { ...r, paused: !r.paused } : r,
                        ),
                      },
                      p.paused ? "Schedule resumed" : "Schedule paused",
                    )
                  }
                >
                  {tr(p.paused ? "Resume" : "Pause")}
                </button>
              )}
              {key === "goals" && (
                <button
                  className="secondary"
                  onClick={() => {
                    setTx({
                      ...initialTx(),
                      type: "savings contribution",
                      destination: p.account,
                      account:
                        data.accounts.find(
                          (a) =>
                            a.id !== p.account &&
                            a.currency === "TZS" &&
                            !a.archived,
                        )?.id || "",
                      party: p.name,
                    });
                    open("transaction");
                  }}
                >
                  <Plus size={14} />
                  {tr(" Add contribution")}
                </button>
              )}
              {key === "budgets" && (
                <button
                  className="text-button"
                  onClick={() => {
                    go("Transactions");
                    setCategory(
                      p.category === "All categories" ? "all" : p.category,
                    );
                    setType("expense");
                    setPeriod("Custom");
                    setFrom(p.start || range.start);
                    setTo(p.end || range.end);
                  }}
                >
                  {tr("View spending ")}
                  <ArrowRight size={14} />
                </button>
              )}
              {key === "debts" && (
                <button
                  className="secondary"
                  disabled={outstanding(p, data.transactions) === 0}
                  onClick={() => {
                    setTx({
                      ...initialTx(),
                      type: "debt repayment",
                      debtId: p.id,
                      repaymentDirection: p.direction === "lent" ? "in" : "out",
                      party: p.name,
                      amount: outstanding(p, data.transactions),
                      category: "Other",
                      notes: `Repayment for ${p.name}`,
                      account: data.accounts[0]?.id || "",
                    });
                    open("transaction");
                  }}
                >
                  {tr("Record repayment")}
                </button>
              )}
            </article>
          );
        })}
        {!data[key].length && (
          <div className="panel empty wide">
            <Target size={32} />
            <h3>{tr("A little planning goes a long way")}</h3>
            <p>
              {tr(
                key === "budgets"
                  ? "Give your money a purpose with a spending budget."
                  : key === "goals"
                    ? "Set a goal and link a dedicated savings account."
                    : key === "debts"
                      ? "Keep track of the people and payments that matter."
                      : "Keep your bills and regular payments in one place.",
              )}
            </p>
            <button
              className="primary"
              onClick={() =>
                open(
                  key === "budgets"
                    ? "budget"
                    : key === "goals"
                      ? "goal"
                      : key === "debts"
                        ? "debt"
                        : "recurring",
                )
              }
            >
              <Plus size={16} />
              {tr(" Get started")}
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={"app " + (collapsed ? "collapsed" : "")}>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">
            M<span>↗</span>
          </span>
          <span>
            MoneyFlow<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="avatar">M</span>
          <div>
            <strong>
              {profile === "My workspace" ? tr(profile) : profile}
            </strong>
            <small>{tr("Personal finance")}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">{tr("WORKSPACE")}</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              <span>{tr(String(name))}</span>
              {name === "Overview" && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={19} />
            <strong>{tr("Your finances. Your space.")}</strong>
            <p>
              {tr("Stored locally on this device.")}
              <br />
              {tr("Always in your control.")}
            </p>
            <button onClick={() => go("Sync & backup")}>
              {tr("Storage & backup ")}
              <ArrowRight size={14} />
            </button>
          </div>
          <button onClick={() => go("Settings")}>
            <Settings size={19} />
            <span>{tr("Settings")}</span>
          </button>
          <button onClick={() => open("help")}>
            <HelpCircle size={19} />
            <span>{tr("Help & getting started")}</span>
          </button>
          <div className="profile-row">
            <span className="avatar neutral">Y</span>
            <div>
              <strong>{tr("You")}</strong>
              <small>{tr("Personal workspace")}</small>
            </div>
            <button
              className="icon-button"
              aria-label={tr("Toggle sidebar")}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {tr("Workspace ")}
            <ChevronRight size={13} /> <strong>{tr(String(page))}</strong>
          </div>
          <div className="top-actions">
            <LanguageToggle />
            <span className="local-status" onClick={() => go("Sync & backup")}>
              <span className={online ? "status-dot" : "status-dot offline"} />
              {tr(online ? "Local workspace" : "Offline mode")}
            </span>
            <button
              className="icon-button"
              aria-label={tr("Toggle theme")}
              onClick={() => changeTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="icon-button notification"
              aria-label={tr("Notifications")}
              onClick={() => go("Notifications")}
            >
              <Bell size={19} />
              {due.length > 0 && <i />}
            </button>
            <span className="top-avatar">Y</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{tr("YOUR FINANCIAL PICTURE")}</div>
              <h1>
                {tr(
                  page === "Overview"
                    ? "A little clarity. A lot of possibility."
                    : page,
                )}
              </h1>
              <p>
                {tr(
                  page === "Overview"
                    ? "Welcome back. Here’s where your money stands."
                    : page === "Transactions"
                      ? "Every movement, all in one place."
                      : page === "Accounts"
                        ? "Different places. One clear picture."
                        : page === "Budgets"
                          ? "Make room for what matters."
                          : page === "Savings goals"
                            ? "Turn your someday into a plan."
                            : "Keep your money moving with intention.",
                )}
              </p>
            </div>
            <div className="heading-actions">
              {page === "Overview" ||
              page === "Transactions" ||
              page === "Reports" ? (
                <>
                  <button
                    className="secondary export-button"
                    onClick={exportCSV}
                  >
                    <Download size={16} />
                    {tr(" Export")}
                  </button>
                  <button className="primary" onClick={addTx}>
                    <Plus size={17} />
                    {tr(" Add transaction")}
                  </button>
                </>
              ) : (
                <button
                  className="primary"
                  onClick={() =>
                    open(
                      page === "Accounts"
                        ? "account"
                        : page === "Budgets"
                          ? "budget"
                          : page === "Savings goals"
                            ? "goal"
                            : page === "Loans & debts"
                              ? "debt"
                              : page === "Recurring" || page === "Calendar"
                                ? "recurring"
                                : page === "Categories"
                                  ? "category"
                                  : "help",
                    )
                  }
                >
                  <Plus size={17} />
                  {tr(
                    page === "Accounts"
                      ? "Add account"
                      : page === "Budgets"
                        ? "Create budget"
                        : page === "Savings goals"
                          ? "New goal"
                          : page === "Loans & debts"
                            ? "Add debt or loan"
                            : page === "Recurring" || page === "Calendar"
                              ? "Add schedule"
                              : "Get help",
                  )}
                </button>
              )}
            </div>
          </div>
          {!ready ? (
            <div className="panel empty">{tr("Opening your workspace…")}</div>
          ) : (
            <>
              {["Overview", "Transactions", "Budgets", "Reports"].includes(
                page,
              ) && (
                <div className="period-bar">
                  <div className="segmented">
                    {["This month", "This week", "This year", "All time"].map(
                      (p) => (
                        <button
                          key={p}
                          className={period === p ? "chosen" : ""}
                          onClick={() => {
                            setPeriod(p);
                            setPagination(0);
                          }}
                        >
                          {tr(String(p))}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="date-select">
                    <CalendarDays size={15} />
                    <select
                      aria-label={tr("Financial period")}
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      {[
                        "Today",
                        "This week",
                        "This month",
                        "This year",
                        "All time",
                        "Custom",
                      ].map((p) => (
                        <option key={p} value={p}>
                          {tr(String(p))}
                        </option>
                      ))}
                    </select>
                    {period !== "Custom" && (
                      <span>
                        {new Date(
                          range.start === "0000"
                            ? now
                            : range.start + "T12:00:00",
                        ).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {new Date(now + "T12:00:00").toLocaleDateString(
                          locale,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                    )}
                    <ChevronDown size={13} />
                  </div>
                  {period === "Custom" && (
                    <div className="custom-dates">
                      <input
                        aria-label={tr("Start date")}
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <input
                        aria-label={tr("End date")}
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
              {page === "Overview" && (
                <>
                  <div className="stat-grid">
                    <button
                      className="stat-card balance-card"
                      onClick={() => go("Accounts")}
                    >
                      <div className="stat-label">
                        {tr("Total balance ")}
                        <Wallet size={17} />
                      </div>
                      <h2>{money(total)}</h2>
                      <div className="stat-foot">
                        <span className="balance-badge">
                          <span />
                          {tr(" Across ")}
                          {tzAccounts.length}
                          {tr(" accounts")}
                        </span>
                        <span>
                          TZS <ChevronDown size={12} />
                        </span>
                      </div>
                      <div className="balance-decoration" />
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => drill("income")}
                    >
                      <div className="stat-label">
                        {tr("Money in")}{" "}
                        <span className="mini-icon green">
                          <ArrowDownLeft size={16} />
                        </span>
                      </div>
                      <h2>{money(summary.income)}</h2>
                      <div className="stat-foot">
                        <span className="positive">
                          <ArrowDownLeft size={13} />
                          {tr(" Income")}
                        </span>
                        <span>{tr("this period")}</span>
                      </div>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => drill("expense")}
                    >
                      <div className="stat-label">
                        {tr("Money out")}{" "}
                        <span className="mini-icon rose">
                          <ArrowUpRight size={16} />
                        </span>
                      </div>
                      <h2>{money(summary.expense)}</h2>
                      <div className="stat-foot">
                        <span className="expense-text">
                          <ArrowUpRight size={13} />
                          {tr(" Expenses")}
                        </span>
                        <span>{tr("this period")}</span>
                      </div>
                    </button>
                    <button className="stat-card" onClick={() => go("Reports")}>
                      <div className="stat-label">
                        {tr("Net cash flow")}{" "}
                        <span className="mini-icon lavender">
                          <ArrowLeftRight size={16} />
                        </span>
                      </div>
                      <h2>{money(summary.income - summary.expense)}</h2>
                      <div className="stat-foot">
                        <span
                          className={
                            summary.income - summary.expense >= 0
                              ? "positive"
                              : "expense-text"
                          }
                        >
                          <TrendingUp size={13} />
                          {tr(" Income − expenses")}
                        </span>
                      </div>
                    </button>
                  </div>
                  <div className="dashboard-middle">
                    <section className="panel cashflow-panel">
                      <div className="section-heading">
                        <div>
                          <h3>
                            {tr("Balance over time")}{" "}
                            <span className="subtle-pill">TZS</span>
                          </h3>
                          <p>{tr("The bigger picture, one day at a time.")}</p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={tr("View balance report")}
                          onClick={() => go("Reports")}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i style={{ background: "#7565e9" }} />
                          {tr(" Account balance")}
                        </span>
                        <strong>{money(total)}</strong>
                        <span className="chart-note">{tr("Last 34 days")}</span>
                      </div>
                      <div className="area-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={chart}
                            margin={{ top: 15, right: 8, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id="balance-fill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#8473eb"
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#8473eb"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 5"
                              vertical={false}
                              stroke="var(--line)"
                            />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              minTickGap={40}
                              tick={{ fontSize: 11, fill: "#9295a5" }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={50}
                              tickFormatter={(v) =>
                                v >= 1000000
                                  ? `${v / 1000000}m`
                                  : v >= 1000
                                    ? `${v / 1000}k`
                                    : v
                              }
                              tick={{ fontSize: 11, fill: "#9295a5" }}
                            />
                            <Tooltip
                              formatter={(v) => money(Number(v))}
                              contentStyle={{
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                color: "#24243b",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="balance"
                              stroke="#7866e6"
                              strokeWidth={2.5}
                              fill="url(#balance-fill)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-footer">
                        <ShieldCheck size={14} />
                        {tr(
                          " Based on posted transactions and opening balances",
                        )}{" "}
                        <button onClick={() => go("Reports")}>
                          {tr("View report ")}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </section>
                    <section className="panel spending-panel">
                      <div className="section-heading">
                        <div>
                          <h3>{tr("Spending breakdown")}</h3>
                          <p>{tr("Where your money went.")}</p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={tr("View spending report")}
                          onClick={() => go("Reports")}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <div className="donut-wrap">
                        {spending.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={spending}
                                innerRadius={67}
                                outerRadius={85}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                                onClick={(d) => {
                                  go("Transactions");
                                  setCategory(String(d.name));
                                }}
                              >
                                {spending.map((s) => (
                                  <Cell key={s.name} fill={s.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => money(Number(v))} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="empty-donut" />
                        )}
                        <div className="donut-center">
                          <small>{tr("Total spent")}</small>
                          <strong>{money(summary.expense)}</strong>
                          <span>{tr(period.toLowerCase())}</span>
                        </div>
                      </div>
                      <div className="category-legend">
                        {spending.length ? (
                          spending.slice(0, 4).map((s) => (
                            <button
                              key={s.name}
                              onClick={() => {
                                go("Transactions");
                                setCategory(s.name);
                              }}
                            >
                              <span>
                                <i style={{ background: s.color }} />
                                {tr(s.name)}
                              </span>
                              <strong>
                                {Math.round(
                                  (s.value /
                                    spending.reduce((a, s) => a + s.value, 0)) *
                                    100,
                                )}
                                %
                              </strong>
                            </button>
                          ))
                        ) : (
                          <p className="muted center">
                            {tr("Your categories will appear as you spend.")}
                          </p>
                        )}
                      </div>
                      <button
                        className="panel-link"
                        onClick={() => go("Reports")}
                      >
                        {tr("Explore spending ")}
                        <ArrowRight size={14} />
                      </button>
                    </section>
                  </div>
                  <div className="dashboard-lower">
                    <section className="panel recent-panel">
                      <div className="section-heading">
                        <div>
                          <h3>{tr("Recent transactions")}</h3>
                          <p>{tr("The latest moves in your money.")}</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => go("Transactions")}
                        >
                          {tr("View all ")}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                      {table(
                        [...data.transactions]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .slice(0, 4),
                        true,
                      )}
                    </section>
                    <section className="panel accounts-panel">
                      <div className="section-heading">
                        <div>
                          <h3>
                            {tr("Your accounts")}{" "}
                            <span className="count">
                              {data.accounts.length}
                            </span>
                          </h3>
                          <p>{tr("A home for every shilling.")}</p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={tr("Add account")}
                          onClick={() => open("account")}
                        >
                          <Plus size={19} />
                        </button>
                      </div>
                      {data.accounts.length ? (
                        data.accounts.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            className="account-row"
                            onClick={() => {
                              go("Transactions");
                              setAccount(a.id);
                              setPeriod("All time");
                            }}
                          >
                            <span
                              className="account-icon"
                              style={{
                                background: a.color + "15",
                                color: a.color,
                              }}
                            >
                              {a.type === "Mobile money" ? (
                                <Smartphone size={20} />
                              ) : a.type === "Cash" ? (
                                <Banknote size={20} />
                              ) : (
                                <Landmark size={20} />
                              )}
                            </span>
                            <span>
                              <strong>{a.name}</strong>
                              <small>
                                {tr(a.type)}
                                {tr(" · Manual")}
                              </small>
                            </span>
                            <b>
                              {money(balance(a, data.transactions), a.currency)}
                            </b>
                            <ChevronRight size={14} />
                          </button>
                        ))
                      ) : (
                        <div className="empty small">
                          <Wallet size={28} />
                          <h3>{tr("Where does your money live?")}</h3>
                          <p>
                            {tr("Add cash, a bank account or mobile wallet.")}
                          </p>
                          <button
                            className="text-button"
                            onClick={() => open("account")}
                          >
                            {tr("Add an account ")}
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                      <button
                        className="panel-link"
                        onClick={() => go("Accounts")}
                      >
                        {tr("Manage accounts ")}
                        <ArrowRight size={14} />
                      </button>
                    </section>
                  </div>
                  <div className="insight-strip">
                    <span className="insight-icon">
                      <TrendingUp size={20} />
                    </span>
                    <div>
                      <strong>{tr("A clearer picture starts here")}</strong>
                      <p>
                        {tr(
                          data.transactions.length
                            ? `You have recorded ${data.transactions.length} transactions. ${spending[0] ? `${spending[0].name} is your largest spending category this period.` : "Keep tracking to discover your spending patterns."}`
                            : "Add your accounts and a few transactions. Your personal insights will grow from there.",
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        data.accounts.length ? go("Reports") : open("account")
                      }
                    >
                      {tr(
                        data.accounts.length
                          ? "Explore insights"
                          : "Set up your accounts",
                      )}{" "}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </>
              )}
              {page === "Transactions" && (
                <section className="panel">
                  <div className="filter-row">
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        placeholder={tr("Search transactions, tags, amounts…")}
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPagination(0);
                        }}
                      />
                    </label>
                    <select
                      aria-label={tr("Transaction type")}
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="all">{tr("All types")}</option>
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {tr(String(t))}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={tr("Account filter")}
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    >
                      <option value="all">{tr("All accounts")}</option>
                      {data.accounts.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={tr("Category filter")}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">{tr("All categories")}</option>
                      {data.categories.map((c) => (
                        <option key={c} value={c}>
                          {tr(String(c))}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary"
                      onClick={() => {
                        open("import");
                        setImportRows([]);
                      }}
                    >
                      <Upload size={15} />
                      {tr(" Import")}
                    </button>
                  </div>
                  <div className="table-meta">
                    <span>
                      {filtered.length}
                      {tr(" transactions")}
                      {tr(
                        selected.length ? ` · ${selected.length} selected` : "",
                      )}
                    </span>
                    {selected.length > 0 && (
                      <select
                        aria-label={tr("Bulk categorize")}
                        defaultValue=""
                        onChange={(e) => {
                          void commit(
                            {
                              ...data,
                              transactions: data.transactions.map((t) =>
                                selected.includes(t.id)
                                  ? {
                                      ...t,
                                      category: e.target.value,
                                      updated: new Date().toISOString(),
                                    }
                                  : t,
                              ),
                            },
                            "Selected transactions categorized",
                          );
                          setSelected([]);
                        }}
                      >
                        <option disabled value="">
                          {tr("Categorize selected")}
                        </option>
                        {data.categories.map((c) => (
                          <option key={c} value={c}>
                            {tr(String(c))}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      aria-label={tr("Sort transactions")}
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="newest">{tr("Newest first")}</option>
                      <option value="oldest">{tr("Oldest first")}</option>
                      <option value="amount">{tr("Largest amount")}</option>
                    </select>
                  </div>
                  {table(filtered.slice(pagination * 15, pagination * 15 + 15))}
                  <div className="pagination">
                    <span>
                      {tr("Page ")}
                      {pagination + 1}
                      {tr(" of")} {Math.max(1, Math.ceil(filtered.length / 15))}
                    </span>
                    <button
                      className="icon-button"
                      disabled={!pagination}
                      aria-label={tr("Previous page")}
                      onClick={() => setPagination(pagination - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={(pagination + 1) * 15 >= filtered.length}
                      aria-label={tr("Next page")}
                      onClick={() => setPagination(pagination + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </section>
              )}
              {page === "Accounts" && (
                <>
                  <div className="plan-grid">
                    {data.accounts.map((a) => (
                      <article className="panel account-card" key={a.id}>
                        <div className="section-heading">
                          <span
                            className="account-icon"
                            style={{
                              background: a.color + "18",
                              color: a.color,
                            }}
                          >
                            <Wallet size={23} />
                          </span>
                          <span className="tag">
                            {tr(a.archived ? "Archived" : "Manual account")}
                          </span>
                        </div>
                        <h3>{a.name}</h3>
                        <p className="muted">
                          {tr(a.type)} · {a.currency}
                        </p>
                        <h2>
                          {money(balance(a, data.transactions), a.currency)}
                        </h2>
                        <p className="muted">
                          {tr("Opening balance ")}
                          {money(a.opening, a.currency)}
                        </p>
                        <div className="card-actions">
                          <button
                            className="icon-button"
                            aria-label={"Edit " + a.name}
                            onClick={() => {
                              open("account");
                              setForm({
                                id: a.id,
                                name: a.name,
                                type: a.type,
                                amount: String(a.opening),
                                currency: a.currency,
                                color: a.color,
                              });
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              go("Transactions");
                              setAccount(a.id);
                              setPeriod("All time");
                            }}
                          >
                            {tr("View statement ")}
                            <ArrowRight size={14} />
                          </button>
                          <button
                            className="icon-button"
                            title={tr(
                              a.archived
                                ? "Restore account"
                                : "Archive account",
                            )}
                            onClick={() =>
                              void commit(
                                {
                                  ...data,
                                  accounts: data.accounts.map((x) =>
                                    x.id === a.id
                                      ? { ...x, archived: !x.archived }
                                      : x,
                                  ),
                                },
                                a.archived
                                  ? "Account restored"
                                  : "Account archived",
                              )
                            }
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                    <button
                      className="add-account-card"
                      onClick={() => open("account")}
                    >
                      <Plus size={26} />
                      <strong>{tr("Add an account")}</strong>
                      <span>{tr("Cash, bank, mobile money and more")}</span>
                    </button>
                  </div>
                  <div className="notice">
                    <ShieldCheck size={18} />
                    {tr(
                      " Accounts are manually maintained. No bank or mobile money provider is connected. Currencies are shown separately; dashboard totals include TZS only.",
                    )}
                  </div>
                </>
              )}
              {page === "Budgets" && planCards("budgets")}
              {page === "Savings goals" && planCards("goals")}
              {page === "Loans & debts" && (
                <>
                  <div className="mini-stats">
                    <div className="panel">
                      <small>{tr("You owe")}</small>
                      <h2>{money(obligations)}</h2>
                    </div>
                    <div className="panel">
                      <small>{tr("Owed to you")}</small>
                      <h2>
                        {money(
                          data.debts
                            .filter((d) => d.direction === "lent")
                            .reduce(
                              (s, d) => s + outstanding(d, data.transactions),
                              0,
                            ),
                        )}
                      </h2>
                    </div>
                    <div className="panel">
                      <small>{tr("Overdue recorded principal")}</small>
                      <h2>
                        {money(
                          data.debts
                            .filter((d) => d.date < now)
                            .reduce(
                              (s, d) => s + outstanding(d, data.transactions),
                              0,
                            ),
                        )}
                      </h2>
                    </div>
                  </div>
                  <div className="notice">
                    {tr(
                      "Debt records track your agreements. Record issuance in the ledger; linked repayments reduce outstanding principal automatically. Interest is reported separately.",
                    )}
                  </div>
                  {planCards("debts")}
                </>
              )}
              {page === "Recurring" && planCards("recurring")}
              {page === "Calendar" && (
                <section className="panel calendar">
                  <div className="section-heading">
                    <h3>
                      {new Date(now + "T12:00:00").toLocaleDateString(locale, {
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                    <span className="tag">{tr("Scheduled, not paid")}</span>
                  </div>
                  <div className="calendar-grid">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <strong key={d}>{tr(String(d))}</strong>
                      ),
                    )}
                    {Array.from(
                      {
                        length: new Date(
                          Number(now.slice(0, 4)),
                          Number(now.slice(5, 7)) - 1,
                          1,
                        ).getDay(),
                      },
                      (_, i) => (
                        <div key={"blank" + i} />
                      ),
                    )}
                    {Array.from(
                      {
                        length: new Date(
                          Number(now.slice(0, 4)),
                          Number(now.slice(5, 7)),
                          0,
                        ).getDate(),
                      },
                      (_, i) => {
                        const date =
                          month + "-" + String(i + 1).padStart(2, "0");
                        return (
                          <div
                            className={date === now ? "current-day" : ""}
                            key={date}
                          >
                            <b>{i + 1}</b>
                            {data.recurring
                              .filter((r) => r.date === date)
                              .map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => {
                                    setTx({
                                      ...initialTx(),
                                      amount: r.amount,
                                      party: r.name,
                                      scheduleId: r.id,
                                      scheduledDate: r.date,
                                      account:
                                        r.account || data.accounts[0]?.id || "",
                                    });
                                    open("transaction");
                                  }}
                                >
                                  {r.name}
                                  <small>{money(r.amount)}</small>
                                </button>
                              ))}
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>
              )}
              {page === "Reports" && (
                <>
                  <div className="mini-stats">
                    <div className="panel">
                      <small>{tr("Net financial position · TZS")}</small>
                      <h2>
                        {money(
                          total +
                            data.debts
                              .filter((d) => d.direction === "lent")
                              .reduce(
                                (s, d) => s + outstanding(d, data.transactions),
                                0,
                              ) -
                            obligations,
                        )}
                      </h2>
                      <p className="muted">
                        {tr(
                          "Accounts + recorded receivables − recorded payables",
                        )}
                      </p>
                    </div>
                    <div className="panel">
                      <small>{tr("After scheduled obligations")}</small>
                      <h2>{money(safe)}</h2>
                      <p className="muted">
                        {tr("Estimate based on all future recorded schedules")}
                      </p>
                    </div>
                    <div className="panel">
                      <small>{tr("Net savings moves this period")}</small>
                      <h2>
                        {money(
                          reportTx
                            .filter((t) => t.status === "posted")
                            .reduce(
                              (s, t) =>
                                s +
                                (t.type === "savings contribution"
                                  ? t.amount
                                  : t.type === "savings withdrawal"
                                    ? -t.amount
                                    : 0),
                              0,
                            ),
                        )}
                      </h2>
                    </div>
                  </div>
                  <div className="dashboard-middle">
                    <section className="panel report-panel">
                      <div className="section-heading">
                        <h3>{tr("Income & spending by category")}</h3>
                        <button
                          className="secondary"
                          onClick={() => window.print()}
                        >
                          {tr("Print / PDF")}
                        </button>
                      </div>
                      {spending.length ? (
                        <div style={{ height: 320 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={spending}
                              layout="vertical"
                              margin={{ left: 20, right: 25 }}
                            >
                              <XAxis
                                type="number"
                                tickFormatter={(v) => v / 1000 + "k"}
                              />
                              <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip formatter={(v) => money(Number(v))} />
                              <Bar
                                dataKey="value"
                                fill="#7565e9"
                                radius={[0, 5, 5, 0]}
                                onClick={(d) => {
                                  go("Transactions");
                                  setCategory(String(d.name));
                                }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="empty">
                          {tr("Record expenses to build your report.")}
                        </div>
                      )}
                    </section>
                    <section className="panel report-panel">
                      <h3>{tr("Cash flow statement")}</h3>
                      {[
                        ["Income", summary.income],
                        ["Expenses (net of refunds)", summary.expense],
                        ["Net cash flow", summary.income - summary.expense],
                      ].map(([label, value]) => (
                        <div className="report-row" key={label}>
                          <span>{tr(String(label))}</span>
                          <strong>{money(Number(value))}</strong>
                        </div>
                      ))}
                      <p className="muted">
                        {tr(
                          "Transfers, opening balances, savings and loan principal are excluded.",
                        )}
                      </p>
                      <button className="text-button" onClick={exportCSV}>
                        {tr("Download underlying records ")}
                        <Download size={15} />
                      </button>
                    </section>
                  </div>
                  <section className="panel report-panel">
                    <h3>{tr("Audit history")}</h3>
                    {data.audit.length ? (
                      data.audit.slice(0, 30).map((a, i) => (
                        <div className="report-row" key={i}>
                          <span>{tr(a.action)}</span>
                          <small>
                            {new Date(a.date).toLocaleString(locale)}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        {tr("Financial changes will be recorded here.")}
                      </p>
                    )}
                  </section>
                </>
              )}
              {page === "Notifications" && (
                <section className="panel report-panel">
                  <h3>{tr("Your financial reminders")}</h3>
                  {data.budgets.map((b) => {
                    const spent = totals(
                      reportTx.filter(
                        (t) =>
                          b.category === "All categories" ||
                          t.category === b.category,
                      ),
                    ).expense;
                    return spent >= b.amount * 0.75 ? (
                      <div className="report-row" key={b.id}>
                        <span>
                          {b.name}: {Math.round((spent / b.amount) * 100)}
                          {tr("% used")}
                        </span>
                        <button
                          className="text-button"
                          onClick={() => go("Budgets")}
                        >
                          {tr("Review")}
                        </button>
                      </div>
                    ) : null;
                  })}
                  {[...data.recurring, ...data.debts].map((d) => (
                    <div className="report-row" key={d.id}>
                      <span>
                        {d.name} · {money(d.amount)}
                      </span>
                      <span>
                        {tr(d.date < now ? "Overdue" : "Due")} {d.date}
                      </span>
                    </div>
                  ))}
                  {!data.recurring.length && !data.debts.length && (
                    <div className="empty">
                      <Bell size={30} />
                      <h3>{tr("All caught up")}</h3>
                      <p>
                        {tr(
                          "Add budgets and schedules for evidence-based reminders.",
                        )}
                      </p>
                    </div>
                  )}
                </section>
              )}
              {page === "Categories" && (
                <section className="panel report-panel">
                  <h3>{tr("Transaction categories")}</h3>
                  <div className="category-chips">
                    {data.categories.map((c, i) => (
                      <span key={c} className="tag">
                        <i
                          style={{ background: palette[i % palette.length] }}
                        />
                        {tr(String(c))}
                        <button
                          className="icon-button"
                          aria-label={"Remove " + c}
                          onClick={() => {
                            if (
                              data.transactions.some((t) => t.category === c)
                            ) {
                              setToast(
                                "This category is used by transactions and cannot be removed.",
                              );
                              return;
                            }
                            void commit(
                              {
                                ...data,
                                categories: data.categories.filter(
                                  (x) => x !== c,
                                ),
                              },
                              "Category removed",
                            );
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {page === "Settings" && (
                <div className="settings-grid">
                  <section className="panel report-panel">
                    <h3>{tr("Your workspace")}</h3>
                    <label>
                      {tr("Workspace name")}
                      <input
                        value={profile}
                        onChange={(e) => {
                          setProfile(e.target.value);
                          localStorage.setItem("mf-profile", e.target.value);
                        }}
                      />
                    </label>
                    <label>
                      {tr("Appearance")}
                      <select
                        value={theme}
                        onChange={(e) => changeTheme(e.target.value)}
                      >
                        <option value="light">{tr("Light")}</option>
                        <option value="dark">{tr("Dark")}</option>
                      </select>
                    </label>
                    <label>
                      Language / Lugha
                      <select
                        aria-label="Language / Lugha"
                        value={language}
                        onChange={(e) =>
                          setLanguage(e.target.value as "en" | "sw")
                        }
                      >
                        <option value="en" lang="en">
                          English
                        </option>
                        <option value="sw" lang="sw">
                          Kiswahili
                        </option>
                      </select>
                    </label>
                    <label>
                      {tr("Primary currency")}
                      <input disabled value="Tanzanian shilling · TZS" />
                    </label>
                    <label>
                      {tr("Reporting timezone")}
                      <input disabled value="Africa/Dar_es_Salaam (UTC+3)" />
                    </label>
                    <button
                      className="secondary"
                      onClick={() => go("Categories")}
                    >
                      <Tags size={16} />
                      {tr(" Manage categories")}
                    </button>
                  </section>
                  <section className="panel report-panel">
                    <h3>{tr("Security & cloud account")}</h3>
                    <p className="muted">
                      {tr(
                        "This workspace uses local device storage. Only use it on a trusted device. Cloud authentication requires your own configured Supabase project.",
                      )}
                    </p>
                    <button className="secondary" onClick={() => open("auth")}>
                      <ShieldCheck size={16} />
                      {tr(" Sign in / register")}
                    </button>
                    <div className="notice">
                      {tr(
                        "Never enter mobile money PINs, banking passwords or OTPs here.",
                      )}
                    </div>
                    <h3>{tr("Install MoneyFlow")}</h3>
                    <p className="muted">
                      {tr(
                        "On Android, open your browser menu and choose “Install app” or “Add to Home screen”. Installation requires HTTPS or localhost.",
                      )}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => go("Sync & backup")}
                    >
                      {tr("Manage local data & backups ")}
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
              )}
              <div
                style={{ display: page === "Sync & backup" ? "block" : "none" }}
              >
                <CloudSync
                  data={data}
                  onReplace={async (d) => {
                    await commit(d, "Cloud workspace loaded");
                  }}
                />
                {page === "Sync & backup" && (
                  <section className="panel report-panel">
                    <div className="section-heading">
                      <h3>{tr("Local storage & backups")}</h3>
                      <span className="tag">
                        <CloudOff size={14} />
                        {tr(" Local only")}
                      </span>
                    </div>
                    <p>
                      {tr("Your ")}
                      {data.transactions.length}
                      {tr(" transactions and")} {data.accounts.length}
                      {tr(
                        " accounts are stored in IndexedDB on this browser. Records survive reloads and work offline. Cloud status is shown separately above.",
                      )}
                    </p>
                    <div className="notice">
                      {tr(
                        "Export backups regularly. Clearing browser data or losing this device can permanently remove local records. Use the cloud controls above if your Supabase project is configured.",
                      )}
                    </div>
                    <div className="card-actions">
                      <button
                        className="primary"
                        onClick={() =>
                          download(
                            "moneyflow-backup-" + today() + ".json",
                            JSON.stringify(data, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={16} />
                        {tr(" Export full backup")}
                      </button>
                      <label className="secondary file-label">
                        <Upload size={16} />
                        {tr(" Restore backup")}
                        <input
                          type="file"
                          accept="application/json"
                          onChange={async (e) => {
                            try {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const parsed = validateWorkspace(
                                JSON.parse(await file.text()),
                              );
                              if (
                                !Array.isArray(parsed.accounts) ||
                                !Array.isArray(parsed.transactions) ||
                                !Array.isArray(parsed.budgets) ||
                                !Array.isArray(parsed.goals) ||
                                !Array.isArray(parsed.debts) ||
                                !Array.isArray(parsed.recurring) ||
                                !Array.isArray(parsed.categories) ||
                                !Array.isArray(parsed.audit)
                              )
                                throw Error("Invalid backup structure");
                              parsed.transactions.forEach((t) =>
                                validate(t, parsed.accounts),
                              );
                              if (
                                confirm(
                                  tr(
                                    "Replace all local data with this backup? Export your existing data first.",
                                  ),
                                )
                              )
                                await commit(parsed, "Backup restored");
                            } catch {
                              setToast(
                                "Invalid backup. No records were changed.",
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
          <footer>
            <span className="footer-brand">
              <span className="status-dot" />
              {tr(" A little more in control, every day.")}
            </span>
            <span>{tr("Made for your money. Built around you.")}</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {[
          ["Overview", LayoutDashboard],
          ["Transactions", ReceiptText],
          ["Budgets", ChartNoAxesCombined],
          ["More", Menu],
        ].map(([name, Icon]) => (
          <button
            className={page === name ? "active" : ""}
            key={String(name)}
            onClick={() => (name === "More" ? open("more") : go(String(name)))}
          >
            {typeof Icon !== "string" && <Icon size={20} />}
            <span>{tr(name === "Overview" ? "Dashboard" : String(name))}</span>
          </button>
        ))}
        <button
          className="mobile-add"
          onClick={addTx}
          aria-label={tr("Add transaction")}
        >
          <Plus />
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {tr(String(toast))}
        </div>
      )}
      {error && !modal && (
        <div className="toast error" role="alert">
          {tr(String(error))}
          <button className="icon-button" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{tr("MONEYFLOW WORKSPACE")}</span>
                <h2>
                  {tr(
                    modal === "transaction"
                      ? data.transactions.some((t) => t.id === tx.id)
                        ? "Edit transaction"
                        : "Add a transaction"
                      : modal === "detail"
                        ? "Transaction details"
                        : modal === "account"
                          ? form.id
                            ? "Edit your account"
                            : "A new home for your money"
                          : modal === "import"
                            ? "Import transactions"
                            : modal === "auth"
                              ? "Your cloud account"
                              : modal === "help"
                                ? "Make yourself at home"
                                : modal === "more"
                                  ? "Your workspace"
                                  : `${form.id ? "Edit" : "Create"} ${modal}`,
                  )}
                </h2>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label={tr("Close dialog")}
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {tr(String(error))}
              </div>
            )}
            {modal === "transaction" && (
              <form onSubmit={saveTransaction}>
                <div className="type-selector">
                  {["expense", "income", "transfer"].map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={tx.type === t ? "chosen" : ""}
                      onClick={() => setTx({ ...tx, type: t as Kind })}
                    >
                      {t === "expense" ? (
                        <ArrowUpRight size={16} />
                      ) : t === "income" ? (
                        <ArrowDownLeft size={16} />
                      ) : (
                        <ArrowLeftRight size={16} />
                      )}{" "}
                      {tr(String(t))}
                    </button>
                  ))}
                </div>
                <label>
                  {tr("Transaction type")}
                  <select
                    value={tx.type}
                    onChange={(e) =>
                      setTx({ ...tx, type: e.target.value as Kind })
                    }
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {tr(String(t))}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    {tr("Amount")}
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder={tr("0")}
                      value={tx.amount || ""}
                      onChange={(e) =>
                        setTx({ ...tx, amount: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    {tr("Date")}
                    <input
                      type="date"
                      required
                      value={tx.date}
                      onChange={(e) => setTx({ ...tx, date: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  {tr(
                    ["income", "refund", "loan received"].includes(tx.type)
                      ? "Receiving account"
                      : "Source account",
                  )}
                  <select
                    required
                    value={tx.account}
                    onChange={(e) => setTx({ ...tx, account: e.target.value })}
                  >
                    <option value="">{tr("Choose account")}</option>
                    {data.accounts
                      .filter((a) => !a.archived)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                  </select>
                </label>
                {!data.accounts.length && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open("account")}
                  >
                    {tr("Create an account first ")}
                    <ArrowRight size={15} />
                  </button>
                )}
                {[
                  "transfer",
                  "savings contribution",
                  "savings withdrawal",
                ].includes(tx.type) && (
                  <label>
                    {tr("Destination account")}
                    <select
                      required
                      value={tx.destination || ""}
                      onChange={(e) =>
                        setTx({ ...tx, destination: e.target.value })
                      }
                    >
                      <option value="">{tr("Choose destination")}</option>
                      {data.accounts
                        .filter((a) => a.id !== tx.account && !a.archived)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="form-grid">
                  <label>
                    {tr("Category")}
                    <select
                      value={tx.category}
                      onChange={(e) =>
                        setTx({ ...tx, category: e.target.value })
                      }
                    >
                      {data.categories.map((c) => (
                        <option key={c} value={c}>
                          {tr(String(c))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {tr("Status")}
                    <select
                      value={tx.status}
                      onChange={(e) =>
                        setTx({
                          ...tx,
                          status: e.target.value as Transaction["status"],
                        })
                      }
                    >
                      <option value="posted">{tr("Posted")}</option>
                      <option value="pending">{tr("Pending")}</option>
                      <option value="cancelled">{tr("Cancelled")}</option>
                    </select>
                  </label>
                </div>
                <label>
                  {tr("Merchant, payer or recipient")}
                  <input
                    placeholder={tr("e.g. Groceries at Shoppers Plaza")}
                    value={tx.party}
                    onChange={(e) => setTx({ ...tx, party: e.target.value })}
                  />
                </label>
                {tx.type === "debt repayment" && (
                  <label>
                    {tr("Interest / fees included in total")}
                    <input
                      type="number"
                      min="0"
                      value={tx.interest || 0}
                      onChange={(e) =>
                        setTx({ ...tx, interest: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
                <label>
                  {tr("Notes / transaction reference")}
                  <textarea
                    rows={2}
                    value={tx.notes}
                    onChange={(e) => setTx({ ...tx, notes: e.target.value })}
                  />
                </label>
                <label>
                  {tr("Tags")}
                  <input
                    placeholder={tr("Separate with commas")}
                    value={tx.tags}
                    onChange={(e) => setTx({ ...tx, tags: e.target.value })}
                  />
                </label>
                <div className="modal-actions">
                  <span>
                    <ShieldCheck size={14} />
                    {tr(" Saved on this device")}
                  </span>
                  <button className="primary" type="submit">
                    {tr("Save transaction ")}
                    <Check size={16} />
                  </button>
                </div>
              </form>
            )}
            {modal === "detail" && (
              <>
                <div className="detail-amount">
                  {money(tx.amount)}
                  <span>
                    {tx.type} · {tx.status}
                  </span>
                </div>
                {[
                  ["Party", tx.party || "—"],
                  ["Date", tx.date],
                  [
                    "Account",
                    data.accounts.find((a) => a.id === tx.account)?.name,
                  ],
                  ["Category", tx.category],
                  ["Notes", tx.notes || "—"],
                  ["Tags", tx.tags || "—"],
                  ["Modified", new Date(tx.updated).toLocaleString(locale)],
                  ["Storage", "Local device only"],
                ].map(([k, v]) => (
                  <div className="report-row" key={k}>
                    <span className="muted">{tr(String(k))}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
                <div className="modal-actions">
                  <button
                    className="danger-button"
                    onClick={() => void removeTransaction(tx.id)}
                  >
                    <Trash2 size={15} />
                    {tr(" Delete")}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setTx({ ...tx, id: uid(), date: today() });
                      open("transaction");
                    }}
                  >
                    {tr("Duplicate")}
                  </button>
                  <button
                    className="primary"
                    onClick={() => open("transaction")}
                  >
                    <Pencil size={15} />
                    {tr(" Edit")}
                  </button>
                </div>
              </>
            )}
            {[
              "account",
              "budget",
              "goal",
              "debt",
              "recurring",
              "category",
            ].includes(modal) && (
              <form onSubmit={saveForm}>
                <label>
                  {tr(modal === "account" ? "Account name" : "Name")}
                  <input
                    required
                    placeholder={tr(
                      modal === "account"
                        ? "e.g. M-Pesa, CRDB, Cash"
                        : modal === "goal"
                          ? "e.g. Emergency fund"
                          : "Give it a name",
                    )}
                    value={form.name || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                {modal === "account" ? (
                  <>
                    <div className="form-grid">
                      <label>
                        {tr("Account type")}
                        <select
                          value={form.type}
                          onChange={(e) =>
                            setForm({ ...form, type: e.target.value })
                          }
                        >
                          {[
                            "Cash",
                            "Bank account",
                            "Mobile money",
                            "Savings",
                            "Digital wallet",
                            "Business",
                            "Other",
                          ].map((t) => (
                            <option key={t} value={t}>
                              {tr(String(t))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {tr("Currency")}
                        <select
                          value={form.currency}
                          onChange={(e) =>
                            setForm({ ...form, currency: e.target.value })
                          }
                        >
                          {["TZS", "KES", "USD", "EUR", "GBP"].map((c) => (
                            <option key={c} value={c}>
                              {tr(String(c))}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      {tr("Opening balance")}
                      <input
                        type="number"
                        step="1"
                        placeholder={tr("0")}
                        value={form.amount || ""}
                        onChange={(e) =>
                          setForm({ ...form, amount: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {tr("Account color")}
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                      />
                    </label>
                    <p className="muted">
                      {tr(
                        "M-Pesa, Airtel Money, Mixx by Yas and HaloPesa can be added as manual mobile money accounts.",
                      )}
                    </p>
                  </>
                ) : (
                  modal !== "category" && (
                    <>
                      <label>
                        {tr(
                          modal === "budget"
                            ? "Spending limit (TZS)"
                            : modal === "goal"
                              ? "Target amount (TZS)"
                              : "Amount (TZS)",
                        )}
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={form.amount || ""}
                          onChange={(e) =>
                            setForm({ ...form, amount: e.target.value })
                          }
                        />
                      </label>
                      {modal === "budget" || modal === "recurring" ? (
                        <label>
                          {tr("Category")}
                          <select
                            value={form.category}
                            onChange={(e) =>
                              setForm({ ...form, category: e.target.value })
                            }
                          >
                            {modal === "budget" && (
                              <option value="All categories">
                                {tr("All categories")}
                              </option>
                            )}
                            {data.categories.map((c) => (
                              <option key={c} value={c}>
                                {tr(String(c))}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {modal === "debt" && (
                        <label>
                          {tr("Direction")}
                          <select
                            value={form.direction}
                            onChange={(e) =>
                              setForm({ ...form, direction: e.target.value })
                            }
                          >
                            <option value="borrowed">
                              {tr("I borrowed — money I owe")}
                            </option>
                            <option value="lent">
                              {tr("I lent — money owed to me")}
                            </option>
                          </select>
                        </label>
                      )}
                      {modal !== "budget" && (
                        <label>
                          {tr(
                            modal === "recurring"
                              ? "Next due date"
                              : "Target / due date",
                          )}
                          <input
                            type="date"
                            required
                            value={form.date}
                            onChange={(e) =>
                              setForm({ ...form, date: e.target.value })
                            }
                          />
                        </label>
                      )}
                      {(modal === "goal" || modal === "recurring") && (
                        <label>
                          {tr("Linked account")}
                          <select
                            required
                            value={form.account || ""}
                            onChange={(e) =>
                              setForm({ ...form, account: e.target.value })
                            }
                          >
                            <option value="">{tr("Choose account")}</option>
                            {data.accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {modal === "recurring" && (
                        <label>
                          {tr("Frequency")}
                          <select
                            value={form.frequency}
                            onChange={(e) =>
                              setForm({ ...form, frequency: e.target.value })
                            }
                          >
                            {[
                              "Daily",
                              "Weekly",
                              "Fortnightly",
                              "Monthly",
                              "Quarterly",
                              "Annually",
                            ].map((f) => (
                              <option key={f} value={f}>
                                {tr(String(f))}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {modal === "budget" && (
                        <div className="form-grid">
                          <label>
                            {tr("Period starts")}
                            <input
                              type="date"
                              required
                              value={form.start || ""}
                              onChange={(e) =>
                                setForm({ ...form, start: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            {tr("Period ends")}
                            <input
                              type="date"
                              required
                              value={form.end || ""}
                              onChange={(e) =>
                                setForm({ ...form, end: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      )}
                      {modal === "goal" && (
                        <p className="muted">
                          {tr(
                            "Progress uses net savings transfers to the linked account. Use a dedicated account for each goal to avoid double counting.",
                          )}
                        </p>
                      )}
                      {modal === "debt" && (
                        <p className="muted">
                          {tr(
                            "This records an agreement only. Record loan principal separately using “loan given” or “loan received”.",
                          )}
                        </p>
                      )}
                    </>
                  )
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    {tr("Cancel")}
                  </button>
                  <button className="primary" type="submit">
                    {tr(form.id ? "Save" : "Create")} {tr(modal || "")}{" "}
                    <Plus size={16} />
                  </button>
                </div>
              </form>
            )}
            {modal === "import" && (
              <>
                <p className="muted">
                  {tr(
                    "Import a CSV file with date, type, amount, account, category, party and notes. Account names must already exist. Dates use YYYY-MM-DD. Amounts are positive whole shillings.",
                  )}
                </p>
                <label className="upload-zone">
                  <Upload size={25} />
                  <strong>{tr("Choose a CSV statement")}</strong>
                  <span>{tr("Preview and map columns before importing")}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (f) setImportRows(parseCSV(await f.text()));
                        setError("");
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  />
                </label>
                {importRows.length > 0 && (
                  <>
                    <h3>
                      {tr("Map columns · ")}
                      {importRows.length - 1}
                      {tr(" records")}
                    </h3>
                    <div className="form-grid">
                      {Object.entries(mapping).map(([key, index]) => (
                        <label key={key}>
                          {tr(String(key))}
                          <select
                            value={index}
                            onChange={(e) =>
                              setMapping({
                                ...mapping,
                                [key]: Number(e.target.value),
                              })
                            }
                          >
                            {importRows[0].map((c, i) => (
                              <option key={i} value={i}>
                                {tr(String(c))}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="import-preview">
                      {importRows.slice(1, 4).map((r, i) => (
                        <p key={i}>{r.join(" · ")}</p>
                      ))}
                    </div>
                    <button
                      className="primary"
                      onClick={async () => {
                        try {
                          let duplicates = 0;
                          const incoming: Transaction[] = [];
                          const seen = new Set(
                            data.transactions.map(fingerprint),
                          );
                          for (const [i, row] of importRows
                            .slice(1)
                            .entries()) {
                            const acc = data.accounts.find(
                              (a) =>
                                a.name.toLowerCase() ===
                                row[mapping.account]?.toLowerCase(),
                            );
                            if (!acc)
                              throw Error(`Row ${i + 2}: unknown account`);
                            const kind = row[mapping.type] as Kind;
                            if (!types.includes(kind))
                              throw Error(`Row ${i + 2}: invalid type`);
                            if (
                              [
                                "transfer",
                                "savings contribution",
                                "savings withdrawal",
                              ].includes(kind)
                            )
                              throw Error(
                                `Row ${i + 2}: linked transfers must be entered manually`,
                              );
                            const t = {
                              ...initialTx(),
                              type: kind,
                              account: acc.id,
                              amount: Number(row[mapping.amount]),
                              date: row[mapping.date],
                              category: row[mapping.category] || "Other",
                              party: row[mapping.party] || "",
                              notes: row[mapping.notes] || "",
                            };
                            if (
                              !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
                              !Number.isFinite(Date.parse(t.date))
                            )
                              throw Error(`Row ${i + 2}: invalid date`);
                            validate(t, data.accounts);
                            const hash = fingerprint(t);
                            if (seen.has(hash)) {
                              duplicates++;
                              continue;
                            }
                            seen.add(hash);
                            incoming.push(t);
                          }
                          await commit(
                            {
                              ...data,
                              transactions: [...incoming, ...data.transactions],
                            },
                            `Imported ${incoming.length} records; skipped ${duplicates} duplicates`,
                          );
                          setModal(null);
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Import failed",
                          );
                        }
                      }}
                    >
                      {tr("Validate & import")}
                    </button>
                  </>
                )}
              </>
            )}
            {modal === "auth" && <AuthForm onMessage={setToast} />}
            {modal === "more" && (
              <div className="more-nav">
                {[
                  ...nav.map(([name]) => name),
                  "Categories",
                  "Notifications",
                  "Sync & backup",
                  "Settings",
                ].map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      go(name);
                      setModal(null);
                    }}
                  >
                    {tr(String(name))}
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            )}
            {modal === "help" && (
              <div className="help-content">
                <p>
                  {tr(
                    "MoneyFlow gives every shilling a place. Your workspace starts empty, and every number comes from your records.",
                  )}
                </p>
                {[
                  [
                    "1",
                    "Add your accounts",
                    "Start with cash, your bank and mobile money. Enter the balance you have today.",
                  ],
                  [
                    "2",
                    "Record your money moves",
                    "Add income and expenses. Use transfers when moving money between your own accounts.",
                  ],
                  [
                    "3",
                    "Plan for what comes next",
                    "Create budgets, savings goals and schedules, then track progress from real transactions.",
                  ],
                  [
                    "4",
                    "Keep a backup",
                    "Export your full workspace regularly. This version stores records on your device.",
                  ],
                ].map(([n, t, d]) => (
                  <div className="help-step" key={n}>
                    <span>{n}</span>
                    <div>
                      <h3>{tr(String(t))}</h3>
                      <p>{tr(String(d))}</p>
                    </div>
                  </div>
                ))}
                <button className="primary" onClick={() => open("account")}>
                  {tr("Add your first account ")}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
