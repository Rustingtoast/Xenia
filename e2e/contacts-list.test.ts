import { expect, test, type Page } from '@playwright/test';
import { SECTION_CHUNK_SIZE, sectionId } from '../src/lib/contacts.ts';
import { LIST_STICKY_TOP, STANDARD_CONTACTS, groupListEntries, rowSelector, setContacts } from './support.ts';

const sectionTop = (page: Page, id: string) =>
	page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top, id);

// Group order is SQLite's: digits first, then A–Z ignoring case, then non-ASCII letters like "Ä".
const STANDARD_GROUPS = ['112 Emergency', 'Family', 'Work', 'Ärzte'];

test('shows group sections, the Group list and the contact rows', async ({ page }) => {
	const [family] = setContacts();
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Phonebook');
	await expect(page.locator('#contact-count')).toHaveText('4 contacts');
	await expect(page.locator('section h2')).toHaveText(STANDARD_GROUPS);
	await expect(page.getByRole('complementary', { name: 'Group list' }).getByRole('link')).toHaveText(groupListEntries(STANDARD_GROUPS));

	const row = page.locator(rowSelector(family));
	await expect(row.getByRole('link', { name: '+1 555-0101' })).toHaveAttribute('href', 'tel:+1555-0101');
	await expect(row).toContainText('Family');
	await expect(row).toContainText('Zurich');
});

test('shows an empty state without contacts', async ({ page }) => {
	setContacts([]);
	await page.goto('/');

	await expect(page.getByText('No contacts yet.')).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Group list' })).toContainText('No groups yet.');
});

test('tapping a group in the Group list jumps to it', async ({ page }) => {
	// Enough contacts before and after "Work" that the page has to scroll for it.
	const contacts = setContacts([
		...STANDARD_CONTACTS,
		...Array.from({ length: 40 }, (_, i) => ({ groupName: `Club ${i}`, location: 'Bern', phoneNumber: `555 ${1000 + i}` })),
		...Array.from({ length: 40 }, (_, i) => ({ groupName: `Zoo ${i}`, location: 'Bern', phoneNumber: `555 ${2000 + i}` }))
	]);
	await page.goto('/');
	expect(await sectionTop(page, sectionId('Work'))).toBeGreaterThan(1000);

	await page.getByRole('complementary', { name: 'Group list' }).getByRole('link', { name: /^Work/ }).click();

	await expect(page.locator(rowSelector(contacts[1]))).toContainText('(555) 010-0113'); // loaded once in view
	// Just below the sticky top bar and search bar, and stays there.
	expect(Math.abs((await sectionTop(page, sectionId('Work'))) - LIST_STICKY_TOP)).toBeLessThan(20);
});

for (const [screen, viewport] of [
	['a wide screen', { width: 1400, height: 1400 }],
	['a phone', { width: 390, height: 800 }]
] as const) {
	// Also guards --contact-row-height (app.css): if rows and placeholders differ in height, the page jumps.
	test(`a big group loads chunk by chunk while scrolling, without the page jumping, on ${screen}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		const count = SECTION_CHUNK_SIZE * 2 + 50;
		setContacts([
			...STANDARD_CONTACTS,
			...Array.from({ length: count }, (_, i) => ({
				groupName: 'Family',
				location: `City ${String(i).padStart(3, '0')}`,
				phoneNumber: `555 ${1000 + i}`
			}))
		]);
		await page.goto('/');
		const familyRows = page.locator(`#${sectionId('Family')} li[id^=contact_]`);
		await expect(familyRows).toHaveCount(SECTION_CHUNK_SIZE);

		const workTopBefore = await sectionTop(page, sectionId('Work'));
		for (let i = 0; i < 20; i++) {
			await page.mouse.wheel(0, 2000);
			await page.waitForTimeout(100);
		}

		await expect(familyRows).toHaveCount(count + 1); // + the standard "Family" contact
		const scrollY = await page.evaluate(() => window.scrollY);
		// Reserved space matched the loaded rows, so later sections didn't move.
		expect(Math.abs((await sectionTop(page, sectionId('Work'))) + scrollY - workTopBefore)).toBeLessThan(2);
	});
}


for (const [screen, viewport] of [
	['a wide screen', { width: 1400, height: 900 }],
	['a phone', { width: 390, height: 800 }]
] as const) {
	test(`the search bar stays visible above the list while scrolling, on ${screen}`, async ({ page }) => {
		setContacts([
			...STANDARD_CONTACTS,
			...Array.from({ length: 60 }, (_, i) => ({ groupName: 'Club', location: `City ${i}`, phoneNumber: `555 ${1000 + i}` }))
		]);
		await page.setViewportSize(viewport);
		await page.goto('/');
		const search = page.getByRole('searchbox', { name: 'Search contacts' });

		await page.mouse.wheel(0, 3000);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

		await expect(search).toBeInViewport();
		const box = (await search.boundingBox())!;
		expect(box.y).toBeGreaterThanOrEqual(64); // below the top bar, not under it
		expect(box.y + box.height).toBeLessThanOrEqual(LIST_STICKY_TOP);
	});
}

test('long phone numbers are never cut off on wide screens', async ({ page }) => {
	const [contact] = setContacts([
		{ groupName: 'Friends', location: 'Lausanne', phoneNumber: '+1 (555) 010-0108', description: 'A rather long description that fills its column' }
	]);
	await page.goto('/');
	const number = page.locator(rowSelector(contact)).getByRole('link', { name: '+1 (555) 010-0108' });
	expect(await number.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('the phone layout is a centered, phone-wide column with the number first and largest', async ({ page }) => {
	const [contact] = setContacts([{ groupName: 'Doctors', location: 'Bern', phoneNumber: '(555) 010-0116', description: 'Dentist' }]);

	await page.setViewportSize({ width: 767, height: 800 });
	await page.goto('/');
	const column = await page.locator('main > div').first().boundingBox();
	expect(column!.width).toBeLessThanOrEqual(576); // 36rem
	expect(Math.abs(column!.x + column!.width / 2 - 767 / 2)).toBeLessThan(2); // centered

	const row = page.locator(rowSelector(contact));
	const fontSize = (selector: string) => row.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
	expect(await fontSize(':scope > div > a')).toBeGreaterThan(await fontSize(':scope > div > span.truncate')); // number > location
	expect(await fontSize(':scope > div > span.truncate')).toBeGreaterThan(await fontSize(':scope > div > button')); // location > description
	await expect(row.locator(':scope > div .badge')).toBeHidden(); // the group is in the section heading, not repeated per entry

	await page.setViewportSize({ width: 1400, height: 900 });
	await expect(row.locator(':scope > div .badge')).toBeVisible(); // desktop keeps the Group column
});
