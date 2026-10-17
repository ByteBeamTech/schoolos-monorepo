import { expect, Page, test } from '@playwright/test';

const tenantId = 'demo-school';
const email = 'admin@demo-school.com';
const password = 'Demo@123!';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.locator('input[placeholder="e.g. greenwood-school"]').fill(tenantId);
  await page.getByRole('button', { name: /Next/ }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:$|\/)/);
}

test.describe('local SchoolOS browser smoke tests', () => {
  test('admin can sign in and see the dashboard', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText('TOTAL STUDENTS')).toBeVisible();
    await expect(page.getByText('Create a fee plan')).toBeVisible();
  });

  test('fee structure exposes plan management', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/billing/fee-structure');
    await expect(page).toHaveURL(/\/dashboard\/billing\/fee-structure/);
    await expect(page.getByText(/Fee Plans/i).first()).toBeVisible();
    await expect(page.getByText(/Assignments/i).first()).toBeVisible();

    const planLinks = page.locator('a[href*="/dashboard/billing/fee-structure/plans/"]');
    await expect(planLinks.first()).toBeVisible();
    await planLinks.first().click();

    await expect(page).toHaveURL(/\/dashboard\/billing\/fee-structure\/plans\//);
    await expect(page.getByText(/Fee Items/i).first()).toBeVisible();
    await expect(page.getByText(/Edit/i).first()).toBeVisible();
  });

  test('assignment management exposes replace and retire controls', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/billing/fee-structure');
    await page.getByText('Assignments', { exact: true }).click();
    await expect(page.getByText('Replace', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Retire', { exact: true }).first()).toBeVisible();
  });

  test('billing rules can be opened and configured', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/billing/fee-structure');
    await page.getByText('Billing Rules', { exact: true }).click();
    const newRuleButton = page.getByRole('button', { name: /New Billing Rule/ });
    await expect(newRuleButton).toBeVisible();
    await expect(page.getByText(/Billing rules decide when a fee item is billed/i)).toBeVisible();
  });

  test('add student form blocks an invalid phone before submission', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/students');
    await page.getByRole('button', { name: /Add Student/ }).last().click();

    const inputs = page.locator('input');
    await inputs.nth(0).fill('Browser');
    await inputs.nth(1).fill('Validation');
    await inputs.nth(3).fill('12345678901');
    await inputs.nth(3).blur();

    await expect(page.getByText(/10 digits|valid phone/i).first()).toBeVisible();
  });

  test('billing and student routes load without redirecting', async ({ page }) => {
    await signIn(page);
    for (const route of [
      '/dashboard/students',
      '/dashboard/billing/students',
      '/dashboard/billing/collect-fee',
      '/dashboard/billing/receipts',
    ]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('legacy admissions route is gone', async ({ page }) => {
    await page.goto('/dashboard/admissions');
    await expect(page).toHaveURL(/\/dashboard\/admissions/);
    await expect(page.locator('body')).toContainText('404');
  });
});
