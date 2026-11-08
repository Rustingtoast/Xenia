import { expect, test } from '@playwright/test';
import { STANDARD_CONTACTS, rowSelector, setContacts } from './support.ts';

test('delete a contact from its options menu after confirming, then undo it', async ({ page }) => {
	// Two F contacts, so deleting one keeps the F section.
	const [family] = setContacts([...STANDARD_CONTACTS, { groupName: 'Friends', location: 'Bern', phoneNumber: '555 0160' }]);
	await page.goto('/');
	const row = page.locator(rowSelector(family));
	const dialog = page.getByRole('dialog');

	await row.getByRole('button', { name: 'Options for +1 555-0101' }).click();
	await expect(row.locator('li.menu-disabled', { hasText: 'Edit' })).toBeVisible();
	await row.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toContainText('Delete this contact?');
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toBeHidden();
	await expect(row).toBeVisible();

	await row.getByRole('button', { name: 'Options for +1 555-0101' }).click();
	await row.getByRole('button', { name: 'Delete' }).click();
	await dialog.getByRole('button', { name: 'Delete' }).click();

	const banner = page.getByRole('status');
	await expect(banner).toContainText('Contact deleted.');
	await expect(row).toHaveCount(0);
	await expect(page.locator('#contact-count')).toHaveText('4 contacts');

	await banner.getByRole('button', { name: 'Undo' }).click();

	await expect(banner).toHaveText('Contact restored.');
	await expect(row).toContainText('+1 555-0101');
	await expect(page.locator('#contact-count')).toHaveText('5 contacts');
});

test('deleting the last contact of a letter removes its section and side-index link, undo brings them back', async ({ page }) => {
	const [, work] = setContacts();
	await page.goto('/');
	const index = page.getByRole('navigation', { name: 'Jump to letter' });

	await page.locator(rowSelector(work)).getByRole('button', { name: /^Options for/ }).click();
	await page.locator(rowSelector(work)).getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

	await expect(page.locator('section h2')).toHaveText(['A', 'F', '#']);
	await expect(index.getByRole('link')).toHaveText(['A', 'F', '#']);

	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

	await expect(page.locator('section h2')).toHaveText(['A', 'F', 'W', '#']);
	await expect(page.locator(rowSelector(work))).toContainText('(555) 010-0113');
});
