import { expect, test } from '@playwright/test';

// Firefox (and most other) password managers detect login/registration forms from the DOM: a
// password input plus a username field identified by `autocomplete="username"` (falling back to the
// field immediately before the password). These tests pin that shape so it can't regress.
//
// The native "save this password" doorhanger is browser chrome, not page DOM, so it can't be
// asserted in headless Playwright — these instead verify exactly what the manager's content-side
// heuristics read.
test.use({ storageState: { cookies: [], origins: [] } });

test('the login form is shaped for password-manager detection', async ({ page }) => {
	await page.goto('/login');
	const form = page.locator('form');

	await expect(form.locator('input[name="email"]')).toHaveAttribute('type', 'text');
	await expect(form.locator('input[name="email"]')).toHaveAttribute('autocomplete', 'username');
	await expect(form.locator('input[name="password"]')).toHaveAttribute('type', 'password');
	await expect(form.locator('input[name="password"]')).toHaveAttribute('autocomplete', 'current-password');

	// The username field sits before the password field (Firefox's fallback heuristic).
	const names = await form.locator('input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('name')));
	expect(names.indexOf('email')).toBeLessThan(names.indexOf('password'));
});

test('the register form marks the new-password fields for password-manager detection', async ({ page }) => {
	await page.goto('/register');
	const form = page.locator('form');

	await expect(form.locator('input[name="email"]')).toHaveAttribute('autocomplete', 'username');
	await expect(form.locator('input[name="password"]')).toHaveAttribute('type', 'password');
	await expect(form.locator('input[name="password"]')).toHaveAttribute('autocomplete', 'new-password');
	await expect(form.locator('input[name="confirm"]')).toHaveAttribute('type', 'password');
	await expect(form.locator('input[name="confirm"]')).toHaveAttribute('autocomplete', 'new-password');
});
