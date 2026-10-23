import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { empty, Data } from "../lib/finance";
import { validateWorkspace } from "../lib/validation";
test("PostgreSQL migration, RLS, atomic ledger, retries and conflicts", async (t) => {
  const db = new PGlite();
  const userA = "10000000-0000-4000-8000-000000000001",
    userB = "10000000-0000-4000-8000-000000000002",
    a = "20000000-0000-4000-8000-000000000001",
    b = "20000000-0000-4000-8000-000000000002",
    tx = "30000000-0000-4000-8000-000000000001",
    mutation = "40000000-0000-4000-8000-000000000001";
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;insert into auth.users values('${userA}'),('${userB}');`,
  );
  await db.exec(
    await readFile(
      new URL("../supabase/001_finance.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${userA}',false);`,
  );
  const workspace: Data = {
    ...empty,
    accounts: [
      {
        id: a,
        name: "Cash",
        type: "Cash",
        opening: 100000,
        currency: "TZS",
        color: "#6254e8",
      },
      {
        id: b,
        name: "Savings",
        type: "Savings",
        opening: 0,
        currency: "TZS",
        color: "#6254e8",
      },
    ],
    transactions: [
      {
        id: tx,
        type: "transfer",
        amount: 25000,
        account: a,
        destination: b,
        category: "Other",
        party: "Test",
        notes: "",
        tags: "",
        status: "posted",
        date: "2026-10-23",
        updated: "2026-10-23T10:00:00.000Z",
      },
    ],
  };
  const save = (data: Data, version: number, id = crypto.randomUUID()) =>
    db.query<{ result: { version: number } }>(
      "select save_workspace($1::jsonb,$2,$3::uuid) as result",
      [JSON.stringify(data), version, id],
    );
  await t.test("first save and round trip", async () => {
    assert.equal(
      (await save(workspace, 0, mutation)).rows[0].result.version,
      1,
    );
    const r = await db.query<{ result: { data: Data } }>(
      "select read_workspace() as result",
    );
    assert.equal(
      validateWorkspace(r.rows[0].result.data).transactions[0].amount,
      25000,
    );
  });
  await t.test(
    "idempotent retry does not duplicate ledger movements",
    async () => {
      assert.equal(
        (await save(workspace, 0, mutation)).rows[0].result.version,
        1,
      );
      const result = await db.query<{ sum: string }>(
        "select sum(amount)::text as sum from ledger_entries",
      );
      assert.equal(result.rows[0].sum, "0");
    },
  );
  await t.test("stale concurrent revision is rejected", async () => {
    await assert.rejects(() => save(workspace, 0), /VERSION_CONFLICT/);
  });
  await t.test("auditable correction reconciles balances", async () => {
    await save(
      {
        ...workspace,
        transactions: [{ ...workspace.transactions[0], amount: 10000 }],
      },
      1,
    );
    const result = await db.query<{ sum: string }>(
      "select sum(amount)::text as sum from ledger_entries where account_id=$1",
      [a],
    );
    assert.equal(result.rows[0].sum, "-10000");
  });
  await t.test("cross-currency mutation rolls back atomically", async () => {
    await assert.rejects(
      () =>
        save(
          {
            ...workspace,
            accounts: [
              workspace.accounts[0],
              { ...workspace.accounts[1], currency: "USD" },
            ],
          },
          2,
        ),
      /CURRENCY_MISMATCH/,
    );
    const result = await db.query<{ version: number }>(
      "select version from workspaces",
    );
    assert.equal(Number(result.rows[0].version), 2);
  });
  await t.test(
    "RLS hides another user records and denies ID takeover",
    async () => {
      await db.exec(
        `select set_config('request.jwt.claim.sub','${userB}',false);`,
      );
      assert.equal((await db.query("select * from accounts")).rows.length, 0);
      assert.equal(
        (await db.query("select * from ledger_entries")).rows.length,
        0,
      );
      assert.equal((await db.query("select * from audit_logs")).rows.length, 0);
      await assert.rejects(() => save(workspace, 0), /INVALID_OWNER/);
    },
  );
  await t.test("direct writes are denied", async () => {
    await assert.rejects(
      () => db.query("delete from transactions"),
      /permission denied/,
    );
  });
  await t.test("anonymous access cannot invoke financial RPC", async () => {
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      () => db.query("select read_workspace()"),
      /permission denied/,
    );
  });
  await db.close();
});
