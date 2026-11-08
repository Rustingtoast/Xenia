import { expect, test } from '@playwright/test';
import { setContacts } from './support.ts';

// playwright.config.ts makes the browser report a light system theme, so "system" means light here.
test('follows the system theme until toggled, remembers the choice, and can go back to the system theme', async ({ page }) => {
	setContacts();
	const htmlTheme = () => page.evaluate(() => document.documentElement.dataset.theme ?? null);
	const savedTheme = () => page.evaluate(() => localStorage.getItem('theme'));

	await page.goto('/');
	expect(await htmlTheme()).toBeNull();

	await page.getByRole('button', { name: 'Switch to dark mode' }).click();
	await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
	expect(await htmlTheme()).toBe('dark');
	expect(await savedTheme()).toBe('dark');

	await page.reload();
	expect(await htmlTheme()).toBe('dark'); // applied before first paint by src/app.html
	await page.getByRole('button', { name: 'Switch to light mode' }).click();

	await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
	expect(await htmlTheme()).toBeNull(); // back to following the system
	expect(await savedTheme()).toBeNull();
});
