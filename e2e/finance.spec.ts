import { test, expect } from "@playwright/test";
test("account, expense, transfer, reload persistence and CSV export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A little clarity. A lot of possibility.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add an account", exact: true })
    .click();
  await page.getByLabel("Account name").fill("Cash test");
  await page.getByLabel("Account type").selectOption("Cash");
  await page.getByLabel("Opening balance").fill("100000");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByLabel("Amount", { exact: true }).fill("12500");
  await page
    .getByLabel("Merchant, payer or recipient")
    .fill("Market vegetables");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("87,500");
  await expect(page.getByRole("button", { name: /Money out/ })).toContainText(
    "12,500",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("87,500");
  await page.getByRole("button", { name: "Market vegetables expense" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("90,000");
  await page
    .getByRole("button", { name: "Transactions", exact: true })
    .first()
    .click();
  await page
    .getByPlaceholder("Search transactions, tags, amounts…")
    .fill("vegetables");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "moneyflow-transactions.csv",
  );
});
test("mobile layout, dark theme, planning navigation and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Budgets", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Budgets" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
});
test("API denies unauthenticated reads and writes", async ({ request }) => {
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect((await request.put("/api/workspace", { data: {} })).status()).toBe(
    401,
  );
});
