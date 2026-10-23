import { test, expect } from "@playwright/test";

test("Kiswahili persists and transactions keep stable types, categories and user text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "SW", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "sw");
  await expect(
    page.getByRole("heading", {
      name: "Elewa fedha zako. Fungua fursa zaidi.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ongeza akaunti", exact: true })
    .first()
    .click();
  await page.getByLabel("Jina la akaunti").fill("M-Pesa yangu");
  await page.getByLabel("Aina ya akaunti").selectOption("Mobile money");
  await page.getByLabel("Salio la mwanzo").fill("100000");
  await page.getByRole("button", { name: "Unda akaunti", exact: true }).click();
  await page
    .getByRole("button", { name: "Ongeza muamala", exact: true })
    .click();
  await page.getByLabel("Kiasi", { exact: true }).fill("10000");
  await page
    .getByRole("combobox", { name: "Kundi", exact: true })
    .selectOption("Transport");
  await page
    .getByLabel("Mfanyabiashara, mlipaji au mpokeaji")
    .fill("Nauli ya daladala");
  await page
    .getByRole("button", { name: "Hifadhi muamala", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /Salio lote/ })).toContainText(
    "90,000",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "sw");
  await expect(
    page.getByRole("heading", {
      name: "Elewa fedha zako. Fungua fursa zaidi.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("button", { name: "Nauli ya daladala expense" }),
  ).toBeVisible();
  await expect(page.locator("tbody")).toContainText("Transport");
  await expect(
    page.getByRole("button", { name: /M-Pesa yangu/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toContainText("90,000");
});

test("language settings and mobile layout switch together", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Total balance/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Language / Lugha", exact: true })
    .selectOption("sw");
  await expect(page.locator("html")).toHaveAttribute("lang", "sw");
  await expect(
    page.getByRole("combobox", { name: "Mwonekano", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Appearance", exact: true }),
  ).toBeVisible();
});
