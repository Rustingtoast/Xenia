import { expect, test } from '@playwright/test';
import { setContacts } from './support.ts';

test('Export opens a placeholder dialog with Excel/PDF and a save location', async ({ page }) => {
	setContacts();
	await page.goto('/');
	const groupList = page.getByRole('complementary', { name: 'Group list' });

	await groupList.getByRole('button', { name: 'Export' }).click();
	const dialog = page.getByRole('dialog', { name: 'Export' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('radio', { name: 'Excel (.xlsx)' })).toBeChecked();
	await expect(dialog.getByRole('textbox', { name: 'Save location' })).toHaveValue('Downloads');

	await dialog.getByRole('radio', { name: 'PDF (.pdf)' }).check();
	await expect(dialog.getByRole('button', { name: 'Export PDF (.pdf)' })).toBeDisabled(); // placeholder

	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
});

test('Settings opens a placeholder dialog listing dark mode and language', async ({ page }) => {
	setContacts();
	await page.goto('/');

	await page.getByRole('complementary', { name: 'Group list' }).getByRole('button', { name: 'Settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toContainText('Dark mode');
	await expect(dialog).toContainText('Language');

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});

test.describe('on phones', () => {
	test.use({ viewport: { width: 390, height: 800 } });

	test('Export and Settings sit at the bottom of the Group list; Escape closes only the dialog', async ({ page }) => {
		setContacts();
		await page.goto('/');
		const groupList = page.getByRole('complementary', { name: 'Group list' });
		await page.getByRole('button', { name: 'Open group list' }).click();

		const exportButton = groupList.getByRole('button', { name: 'Export' });
		const settingsButton = groupList.getByRole('button', { name: 'Settings' });
		const [exportBox, settingsBox, listBox] = await Promise.all([
			exportButton.boundingBox(),
			settingsButton.boundingBox(),
			groupList.boundingBox()
		]);
		expect(exportBox!.y).toBeLessThan(settingsBox!.y); // Export above Settings
		expect(listBox!.y + listBox!.height - (settingsBox!.y + settingsBox!.height)).toBeLessThan(24); // at the bottom

		await settingsButton.click();
		await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
		await page.keyboard.press('Escape');

		await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden();
		await expect(groupList).toBeVisible();
	});
});
