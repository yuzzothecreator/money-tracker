import { test, expect } from "@playwright/test";
test("budget, savings transfer, partial debt repayment and recurring payment reconcile", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add an account", exact: true })
    .click();
  await page.getByLabel("Account name").fill("Cash");
  await page.getByLabel("Opening balance").fill("100000");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page.getByLabel("Account name").fill("Savings");
  await page.getByLabel("Account type").selectOption("Savings");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Budgets", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create budget", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Groceries plan");
  await page.getByLabel("Spending limit (TZS)").fill("20000");
  await page
    .getByRole("button", { name: "Create budget", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Groceries plan" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Savings goals", exact: true })
    .click();
  await page.getByRole("button", { name: "New goal" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Emergency fund");
  await page.getByLabel("Target amount (TZS)").fill("50000");
  await page.getByLabel("Linked account").selectOption({ label: "Savings" });
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  await page.getByRole("button", { name: "Add contribution" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Emergency fund" }) }),
  ).toContainText("10,000");
  await page
    .getByRole("button", { name: "Loans & debts", exact: true })
    .click();
  await page.getByRole("button", { name: "Add debt or loan" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Family loan");
  await page.getByLabel("Amount (TZS)").fill("10000");
  await page.getByRole("button", { name: "Create debt", exact: true }).click();
  await page.getByRole("button", { name: "Record repayment" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("4000");
  await page.getByLabel("Interest / fees included in total").fill("500");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(
    page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Family loan" }) }),
  ).toContainText("6,500");
  await page.getByRole("button", { name: "Recurring", exact: true }).click();
  await page.getByRole("button", { name: "Add schedule" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Internet bill");
  await page.getByLabel("Amount (TZS)").fill("1000");
  await page.getByLabel("Linked account").selectOption({ label: "Cash" });
  await page
    .getByRole("button", { name: "Create recurring", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByRole("button", { name: "Save transaction" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Schedule paused" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("95,000");
  await expect(page.getByRole("button", { name: /Money out/ })).toContainText(
    "1,500",
  );
});
