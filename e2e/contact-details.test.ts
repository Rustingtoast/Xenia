import { expect, test } from '@playwright/test';
import { ContactField, CONTACT_FIELD_LABELS } from '../src/lib/contact-fields.ts';
import { STANDARD_CONTACTS, rowField, rowSelector, setContacts } from './support.ts';

const LONG_DESCRIPTION =
	'Dr. Weber, family doctor.\nOpening hours: Mon–Fri 8–12 and 14–18.\nEmergencies outside these hours: call the emergency practice.';

for (const [screen, viewport] of [
	['a wide screen', { width: 1400, height: 900 }],
	['a phone', { width: 390, height: 800 }]
] as const) {
	test(`tapping a contact opens all its details in one view, on ${screen}`, async ({ page }) => {
		const [contact] = setContacts([
			{ groupName: 'Doctors', location: 'Zurich', phoneNumber: '555-0115', description: LONG_DESCRIPTION }
		]);
		await page.setViewportSize(viewport);
		await page.goto('/');
		const row = page.locator(rowSelector(contact));

		// The description is one cropped line in the list.
		const description = row.getByRole('button', { name: /^Details for 555-0115/ });
		expect(await description.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

		// Tap the entry; the number is plain text, so tapping it opens the details like the rest.
		await row.locator(rowField('phone-number')).click();

		const dialog = page.getByRole('dialog', { name: 'Contact details' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
		for (const field of Object.values(ContactField)) {
			await expect(dialog.getByText(CONTACT_FIELD_LABELS[field], { exact: true })).toBeVisible();
		}
		await expect(dialog.locator(`[data-field="${ContactField.Location}"]`)).toHaveText('Zurich');
		await expect(dialog.locator(`[data-field="${ContactField.Group}"]`)).toHaveText('Doctors');
		await expect(dialog.locator(`[data-field="${ContactField.Description}"]`)).toHaveText(LONG_DESCRIPTION);
		await expect(dialog.getByRole('link')).toHaveCount(0); // no "Call": Xenia doesn't dial numbers
		await expect(dialog.getByRole('button')).toHaveText(['Close']);

		await dialog.getByRole('button', { name: 'Close' }).click();
		await expect(dialog).toBeHidden();

		// Keyboard path: the description line is the details button.
		await description.focus();
		await page.keyboard.press('Enter');
		await expect(dialog).toBeVisible();
	});
}

test('the ⋮ menu opens the menu, not the details', async ({ page }) => {
	const [contact] = setContacts();
	await page.goto('/');
	const row = page.locator(rowSelector(contact));

	await row.getByRole('button', { name: /^Options for/ }).click();
	await expect(row.getByRole('button', { name: 'Delete' })).toBeVisible();
	await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('a contact without description shows "No description" in the list and the details', async ({ page }) => {
	const [contact] = setContacts([{ groupName: 'Doctors', location: 'Bern', phoneNumber: '555-0116' }]);
	await page.goto('/');
	const row = page.locator(rowSelector(contact));

	await row.getByRole('button', { name: 'Details for 555-0116: No description' }).click();
	await expect(page.getByRole('dialog', { name: 'Contact details' }).locator(`[data-field="${ContactField.Description}"]`)).toHaveText(
		'No description'
	);
});

test('a restored contact keeps its description', async ({ page }) => {
	// Two Family contacts, so the section stays while one is deleted.
	const [contact] = setContacts([
		{ groupName: 'Family', location: 'Bern', phoneNumber: '555 0160', description: 'Mum' },
		STANDARD_CONTACTS[0]
	]);
	await page.goto('/');
	const row = page.locator(rowSelector(contact));
	await expect(row).toContainText('Mum');

	await row.getByRole('button', { name: /^Options for/ }).click();
	await row.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog', { name: 'Delete this contact?' }).getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

	await expect(row).toContainText('Mum');
});
