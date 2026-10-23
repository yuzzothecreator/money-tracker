import { test, expect } from "@playwright/test";
test("offline transaction entry survives a full reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add an account", exact: true })
    .click();
  await page.getByLabel("Account name").fill("Offline cash");
  await page.getByLabel("Opening balance").fill("50000");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("50,000");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByLabel("Amount", { exact: true }).fill("5000");
  await page
    .getByLabel("Merchant, payer or recipient")
    .fill("Offline purchase");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("45,000");
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("45,000");
  await expect(
    page.getByRole("button", { name: "Offline purchase expense" }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("stale tab changes cannot overwrite another tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("button", { name: /Total balance/ }),
  ).toBeVisible();
  for (const p of [page, other]) {
    await p
      .getByRole("button", { name: "Add an account", exact: true })
      .click();
    await p
      .getByLabel("Account name")
      .fill(p === page ? "First tab" : "Stale tab");
    await p.getByLabel("Opening balance").fill("10000");
  }
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("10,000");
  await other
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(other.getByRole("dialog").getByRole("alert")).toContainText(
    "Data changed in another tab",
  );
  await other.reload();
  await expect(
    other.getByRole("button", { name: /Total balance/ }),
  ).toContainText("10,000");
});
