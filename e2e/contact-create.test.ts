import { expect, test } from '@playwright/test';
import { setContacts } from './support.ts';

test('creating a contact adds it to a new group and updates the count', async ({ page }) => {
	setContacts();
	await page.goto('/');

	await page.getByRole('button', { name: '+ New' }).click();
	const dialog = page.getByRole('dialog', { name: 'New contact' });
	await dialog.getByLabel('Group').fill('Doctors');
	await dialog.getByLabel('Location').fill('Zurich');
	await dialog.getByLabel('Phone number').fill('555 0115');
	await dialog.getByLabel('Description').fill('Dr. Weber');
	await dialog.getByRole('button', { name: 'Add' }).click();

	await expect(page.getByRole('status')).toContainText('Contact added.');
	await expect(page.locator('#contact-count')).toHaveText('5 contacts');
	await expect(page.locator('section h2')).toHaveText(['112 Emergency', 'Doctors', 'Family', 'Work', 'Ärzte']);
	// The new row shows its number (scoped: each row also repeats it in its hidden delete dialog).
	await expect(page.locator('[data-field="phone-number"]', { hasText: '555 0115' })).toBeVisible();
	await expect(page.getByText('Dr. Weber')).toBeVisible();
});

test('creating a contact in an existing group appends it to that section', async ({ page }) => {
	setContacts();
	await page.goto('/');

	await page.getByRole('button', { name: '+ New' }).click();
	const dialog = page.getByRole('dialog', { name: 'New contact' });
	await dialog.getByLabel('Group').fill('Family');
	await dialog.getByLabel('Location').fill('Aarau');
	await dialog.getByLabel('Phone number').fill('555 0200');
	await dialog.getByRole('button', { name: 'Add' }).click();

	await expect(page.getByRole('status')).toContainText('Contact added.');
	await expect(page.locator('#contact-count')).toHaveText('5 contacts');
	// Same group: one section, now with two rows.
	await expect(page.locator('section h2')).toHaveText(['112 Emergency', 'Family', 'Work', 'Ärzte']);
	await expect(page.locator('[data-field="phone-number"]', { hasText: '555 0200' })).toBeVisible();
});

test('the form shows validation errors and keeps the dialog open', async ({ page }) => {
	setContacts();
	await page.goto('/');

	await page.getByRole('button', { name: '+ New' }).click();
	const dialog = page.getByRole('dialog', { name: 'New contact' });
	await dialog.getByRole('button', { name: 'Add' }).click();

	await expect(dialog).toBeVisible();
	await expect(dialog.getByText("can't be blank")).toHaveCount(3); // group, location, phone number

	await dialog.getByLabel('Group').fill('Friends');
	await dialog.getByLabel('Location').fill('Bern');
	await dialog.getByLabel('Phone number').fill('call me');
	await dialog.getByRole('button', { name: 'Add' }).click();
	await expect(dialog.getByText('may only contain digits, spaces, + ( ) . / -')).toBeVisible();

	await expect(page.locator('#contact-count')).toHaveText('4 contacts');
});
