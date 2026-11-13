import { expect, test } from '@playwright/test';
import { rowSelector, setContacts } from './support.ts';

test('editing a contact updates its fields in place and shows a saved banner', async ({ page }) => {
	const [family] = setContacts();
	await page.goto('/');
	const row = page.locator(rowSelector(family));

	await row.getByRole('button', { name: /^Options for/ }).click();
	await row.getByRole('button', { name: 'Edit' }).click();
	const dialog = page.getByRole('dialog', { name: 'Edit contact' });

	// The dialog is pre-filled with the current values.
	await expect(dialog.getByLabel('Group')).toHaveValue('Family');
	await expect(dialog.getByLabel('Location')).toHaveValue('Zurich');
	await expect(dialog.getByLabel('Phone number')).toHaveValue('+1 555-0101');

	await dialog.getByLabel('Location').fill('Bern');
	await dialog.getByLabel('Phone number').fill('555 0199');
	await dialog.getByLabel('Description').fill('Mum');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status')).toContainText('Contact saved.');
	await expect(page.locator('#contact-count')).toHaveText('4 contacts');
	await expect(row).toContainText('Bern');
	await expect(row).toContainText('555 0199');
	await expect(row).toContainText('Mum');
});

test('changing the group moves the contact to that section', async ({ page }) => {
	const [family] = setContacts();
	await page.goto('/');
	const row = page.locator(rowSelector(family));

	await row.getByRole('button', { name: /^Options for/ }).click();
	await row.getByRole('button', { name: 'Edit' }).click();
	const dialog = page.getByRole('dialog', { name: 'Edit contact' });
	await dialog.getByLabel('Group').fill('Work');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status')).toContainText('Contact saved.');
	// Family was the contact's only group, so its section is gone; Work now holds it too.
	await expect(page.locator('section h2')).toHaveText(['112 Emergency', 'Work', 'Ärzte']);
	await expect(page.locator(rowSelector(family))).toContainText('+1 555-0101');
	await expect(page.locator('#contact-count')).toHaveText('4 contacts');
});

test('editing into a brand-new group creates that section', async ({ page }) => {
	const [family] = setContacts();
	await page.goto('/');

	await page.locator(rowSelector(family)).getByRole('button', { name: /^Options for/ }).click();
	await page.locator(rowSelector(family)).getByRole('button', { name: 'Edit' }).click();
	const dialog = page.getByRole('dialog', { name: 'Edit contact' });
	await dialog.getByLabel('Group').fill('Friends');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status')).toContainText('Contact saved.');
	await expect(page.locator('section h2')).toHaveText(['112 Emergency', 'Friends', 'Work', 'Ärzte']);
	await expect(page.locator(rowSelector(family))).toContainText('+1 555-0101');
});

test('the edit form shows validation errors and keeps the dialog open', async ({ page }) => {
	const [family] = setContacts();
	await page.goto('/');

	await page.locator(rowSelector(family)).getByRole('button', { name: /^Options for/ }).click();
	await page.locator(rowSelector(family)).getByRole('button', { name: 'Edit' }).click();
	const dialog = page.getByRole('dialog', { name: 'Edit contact' });

	await dialog.getByLabel('Phone number').fill('call me');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('may only contain digits, spaces, + ( ) . / -')).toBeVisible();
	await expect(page.locator('#contact-count')).toHaveText('4 contacts');
});
