import { expect, test } from '@playwright/test';
import { STANDARD_CONTACTS, groupListEntries, rowSelector, setContacts } from './support.ts';

test('delete a contact from its options menu after confirming, then undo it', async ({ page }) => {
	// Two Family contacts, so deleting one keeps the Family section.
	const [family] = setContacts([...STANDARD_CONTACTS, { groupName: 'Family', location: 'Bern', phoneNumber: '555 0160' }]);
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

test('deleting the last contact of a group removes its section and Group list entry, undo brings them back', async ({ page }) => {
	const [, work] = setContacts();
	await page.goto('/');
	const groupList = page.getByRole('complementary', { name: 'Group list' });

	await page.locator(rowSelector(work)).getByRole('button', { name: /^Options for/ }).click();
	await page.locator(rowSelector(work)).getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

	await expect(page.locator('section h2')).toHaveText(['112 Emergency', 'Family', 'Ärzte']);
	await expect(groupList.getByRole('link')).toHaveText(groupListEntries(['112 Emergency', 'Family', 'Ärzte']));

	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

	await expect(page.locator('section h2')).toHaveText(['112 Emergency', 'Family', 'Work', 'Ärzte']);
	await expect(page.locator(rowSelector(work))).toContainText('(555) 010-0113');
});
