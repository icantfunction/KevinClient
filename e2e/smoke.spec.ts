import { expect, test } from "@playwright/test";

test("login screen renders", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Studio OS" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View a demo workspace" }),
  ).toBeVisible();
});

test("demo dashboard loads core overview", async ({ page }) => {
  await page.goto("/?demo=1");

  await expect(
    page.getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
  await expect(
    page.locator('input[placeholder^="Search clients, sessions, invoices"]'),
  ).toBeVisible();
  await expect(page.getByText("Upcoming sessions")).toBeVisible();
});

test("studio public page renders pricing", async ({ page }) => {
  await page.goto("/studio");

  await expect(
    page.getByRole("heading", { name: "Rental pricing" }),
  ).toBeVisible();
  await expect(page.getByText("Content Studio")).toBeVisible();
});

test("protected mobile routes show auth gates", async ({ page }) => {
  await page.goto("/session/demo-session-001/shot-list");
  await expect(
    page.getByRole("heading", { name: "Sign in to open this shot list" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in from dashboard" }),
  ).toBeVisible();

  await page.goto("/studio-booking/demo-booking-001/check-in");
  await expect(
    page.getByRole("heading", { name: "Sign in to manage this booking" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in from dashboard" }),
  ).toBeVisible();
});
