import { expect, test } from '@playwright/test';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './auth-constants.ts';

// The login/register pages are only reachable signed out, so these tests drop the shared session.
test.use({ storageState: { cookies: [], origins: [] } });

test('an unauthenticated visitor is sent to the login page', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole('heading', { name: 'Log in to Xenia' })).toBeVisible();
});

test('registering creates an account, signs in, and starts an empty phone book', async ({ page }) => {
	const email = `new-${Date.now()}@xenia.local`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('password-123');
	await page.getByLabel('Confirm password').fill('password-123');
	await page.getByRole('button', { name: 'Register' }).click();

	await expect(page).toHaveURL('/');
	await expect(page.locator('#contact-count')).toHaveText('0 contacts');
	await expect(page.getByText('No contacts yet.')).toBeVisible();
	// The account dropdown (person icon) shows the signed-in email.
	await page.getByRole('button', { name: 'Account' }).click();
	await expect(page.getByText(email)).toBeVisible();
});

test('registering rejects a taken email', async ({ page }) => {
	await page.goto('/register');
	await page.getByLabel('Email').fill(TEST_USER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill('password-123');
	await page.getByLabel('Confirm password').fill('password-123');
	await page.getByRole('button', { name: 'Register' }).click();
	await expect(page.getByText('That email is already registered.')).toBeVisible();
});

test('registering rejects mismatched passwords', async ({ page }) => {
	await page.goto('/register');
	await page.getByLabel('Email').fill('fresh@xenia.local');
	await page.getByLabel('Password', { exact: true }).fill('password-123');
	await page.getByLabel('Confirm password').fill('different-password');
	await page.getByRole('button', { name: 'Register' }).click();
	await expect(page.getByText('Passwords do not match.')).toBeVisible();
});

test('logging in with a wrong password shows an error', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(TEST_USER_EMAIL);
	await page.getByLabel('Password').fill('wrong-password');
	await page.getByRole('button', { name: 'Log in' }).click();

	await expect(page.getByText('Incorrect email or password.')).toBeVisible();
	await expect(page).toHaveURL(/\/login/);
});

test('logging in and logging out', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(TEST_USER_EMAIL);
	await page.getByLabel('Password').fill(TEST_USER_PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();

	await expect(page).toHaveURL('/');
	await expect(page.locator('#contact-count')).toBeVisible();

	await page.getByRole('button', { name: 'Account' }).click();
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/login/);
});
