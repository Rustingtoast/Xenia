import { expect, test, type Page } from '@playwright/test';
import { sectionId } from '../src/lib/contacts.ts';
import { LIST_STICKY_TOP, STANDARD_CONTACTS, setContacts } from './support.ts';

// Enough contacts before and after "Work" that the page can scroll it to the top.
const contactsAroundWork = () =>
	setContacts([
		...STANDARD_CONTACTS,
		...Array.from({ length: 30 }, (_, i) => ({ groupName: 'Club', location: `City ${i}`, phoneNumber: `555 ${1000 + i}` })),
		...Array.from({ length: 30 }, (_, i) => ({ groupName: 'Zoo', location: `City ${i}`, phoneNumber: `555 ${2000 + i}` }))
	]);

const mainPosition = (page: Page) =>
	page.locator('main').evaluate((main) => {
		const { left, right, top } = main.getBoundingClientRect();
		return { left, right, top };
	});

test('on wide screens the Group list is shown, with counts, and the hamburger hides and shows it', async ({ page }) => {
	setContacts([...STANDARD_CONTACTS, { groupName: 'family', location: 'Bern', phoneNumber: '555 0160' }]);
	await page.goto('/');
	const groupList = page.getByRole('complementary', { name: 'Group list' });

	await expect(groupList).toBeVisible();
	await expect(groupList.getByRole('link', { name: /^Family/ })).toContainText('2'); // "family" counts as Family
	await expect(page.getByRole('button', { name: 'Close group list' }).first()).toHaveAttribute('aria-expanded', 'true');

	await page.getByRole('button', { name: 'Close group list' }).first().click();
	await expect(groupList).toBeHidden();

	await page.getByRole('button', { name: 'Open group list' }).click();
	await expect(groupList).toBeVisible();
});

for (const [screen, viewport] of [
	['a wide screen (list docked)', { width: 1400, height: 900 }],
	['a medium screen (list slides over)', { width: 1100, height: 900 }],
	['a phone', { width: 390, height: 800 }]
] as const) {
	test(`opening and closing the Group list never moves the contacts, on ${screen}`, async ({ page }) => {
		setContacts();
		await page.setViewportSize(viewport);
		await page.goto('/');
		const hamburger = page.getByRole('banner').getByRole('button', { name: /group list/ });
		const before = await mainPosition(page);

		await hamburger.click();
		await page.waitForTimeout(300); // let the slide animation finish
		expect(await mainPosition(page)).toEqual(before);

		await hamburger.click({ force: true }); // the backdrop may sit over it on smaller screens
		await page.waitForTimeout(300);
		expect(await mainPosition(page)).toEqual(before);
	});
}

test.describe('on a medium screen', () => {
	test.use({ viewport: { width: 1100, height: 900 } });

	test('the Group list is hidden until the hamburger slides it in over the page', async ({ page }) => {
		setContacts();
		await page.goto('/');
		const groupList = page.getByRole('complementary', { name: 'Group list' });

		await expect(groupList).toBeHidden();
		await page.getByRole('button', { name: 'Open group list' }).click();
		await expect(groupList).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(groupList).toBeHidden();
	});
});

test.describe('on phones', () => {
	test.use({ viewport: { width: 390, height: 800 } });

	test('the Group list is hidden until the hamburger opens it; tapping a group jumps there and closes it', async ({ page }) => {
		contactsAroundWork();
		await page.goto('/');
		const groupList = page.getByRole('complementary', { name: 'Group list' });
		const hamburger = page.getByRole('button', { name: 'Open group list' });

		await expect(groupList).toBeHidden();
		await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

		await hamburger.click();
		await expect(groupList).toBeVisible();

		await groupList.getByRole('link', { name: /^Work/ }).click();

		await expect(groupList).toBeHidden();
		await expect
			.poll(() => page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top, sectionId('Work')))
			.toBeCloseTo(LIST_STICKY_TOP, -1); // just below the sticky top bar and search bar
	});

	test('the open Group list closes with its close button, the backdrop or Escape', async ({ page }) => {
		setContacts();
		await page.goto('/');
		const groupList = page.getByRole('complementary', { name: 'Group list' });
		const open = () => page.getByRole('button', { name: 'Open group list' }).click();

		await open();
		await groupList.getByRole('button', { name: 'Close group list' }).click();
		await expect(groupList).toBeHidden();

		await open();
		await page.mouse.click(380, 600); // beside the drawer, on the backdrop
		await expect(groupList).toBeHidden();

		await open();
		await page.keyboard.press('Escape');
		await expect(groupList).toBeHidden();
	});
});
