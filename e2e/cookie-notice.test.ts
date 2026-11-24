import { expect, test } from '@playwright/test';
import { setContacts } from './support.ts';

// The shared storage state has the notice dismissed; these tests bring it back.
test.describe('the cookie notice, until dismissed, on phones', () => {
	test.use({ viewport: { width: 390, height: 700 } });

	test.beforeEach(async ({ page }) => {
		setContacts();
		await page.context().clearCookies({ name: 'cookie-notice' });
		await page.goto('/');
		await expect(page.getByRole('region', { name: 'Cookies' })).toBeVisible();
	});

	test('lies below the open Group list: Settings (the language menu) stays reachable', async ({ page }) => {
		await page.getByRole('button', { name: 'Open group list' }).click();
		await page.getByRole('complementary', { name: 'Group list' }).getByRole('button', { name: 'Settings' }).click();
		await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
	});

	test('leaves room below the list: the last contact scrolls up above it', async ({ page }) => {
		await expect(page.locator('li[id^="contact_"]')).toHaveCount(4);
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

		const noticeTop = (await page.getByRole('region', { name: 'Cookies' }).boundingBox())!.y;
		const rowsBottom = await page
			.locator('li[id^="contact_"]')
			.evaluateAll((rows) => Math.max(...rows.map((row) => row.getBoundingClientRect().bottom)));
		expect(rowsBottom).toBeLessThanOrEqual(noticeTop);
	});
});
