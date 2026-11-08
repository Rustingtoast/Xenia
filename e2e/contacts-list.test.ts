import { expect, test, type Page } from '@playwright/test';
import { SECTION_CHUNK_SIZE } from '../src/lib/contacts.ts';
import { STANDARD_CONTACTS, rowSelector, setContacts } from './support.ts';

const sectionTop = (page: Page, id: string) =>
	page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top, id);

test('shows letter sections, the side index and the contact rows', async ({ page }) => {
	const [family] = setContacts();
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Phonebook');
	await expect(page.locator('#contact-count')).toHaveText('4 contacts');
	await expect(page.locator('section h2')).toHaveText(['A', 'F', 'W', '#']);

	const index = page.getByRole('navigation', { name: 'Jump to letter' });
	await expect(index.getByRole('link')).toHaveText(['A', 'F', 'W', '#']);
	await expect(index.locator('span', { hasText: 'B' })).toBeVisible(); // greyed out, not a link

	const row = page.locator(rowSelector(family));
	await expect(row.getByRole('link', { name: '+1 555-0101' })).toHaveAttribute('href', 'tel:+1555-0101');
	await expect(row).toContainText('Family');
	await expect(row).toContainText('Zurich');
});

test('shows an empty state without contacts', async ({ page }) => {
	setContacts([]);
	await page.goto('/');

	await expect(page.getByText('No contacts yet.')).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Jump to letter' })).toHaveCount(0);
});

test('tapping a letter in the side index jumps to the groups starting with it', async ({ page }) => {
	// Enough contacts before and after W that the page has to scroll for it.
	const contacts = setContacts([
		...STANDARD_CONTACTS,
		...Array.from({ length: 40 }, (_, i) => ({ groupName: `Club ${i}`, location: 'Bern', phoneNumber: `555 ${1000 + i}` })),
		...Array.from({ length: 40 }, (_, i) => ({ groupName: `Zoo ${i}`, location: 'Bern', phoneNumber: `555 ${2000 + i}` }))
	]);
	await page.goto('/');
	expect(await sectionTop(page, 'letter-W')).toBeGreaterThan(1000);

	await page.getByRole('navigation', { name: 'Jump to letter' }).getByRole('link', { name: 'W' }).click();

	await expect(page.locator(rowSelector(contacts[1]))).toContainText('(555) 010-0113'); // W loaded once in view
	expect(Math.abs(await sectionTop(page, 'letter-W'))).toBeLessThan(20); // at the top, and stays there
});

test('a long letter loads chunk by chunk while scrolling, without the page jumping', async ({ page }) => {
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
	const familyRows = page.locator('#letter-F li[id^=contact_]');
	await expect(familyRows).toHaveCount(SECTION_CHUNK_SIZE);

	const wTopBefore = await sectionTop(page, 'letter-W');
	for (let i = 0; i < 20; i++) {
		await page.mouse.wheel(0, 2000);
		await page.waitForTimeout(100);
	}

	await expect(familyRows).toHaveCount(count + 1); // + the standard "Family" contact
	const scrollY = await page.evaluate(() => window.scrollY);
	// Reserved space matched the loaded rows, so later sections didn't move.
	expect(Math.abs((await sectionTop(page, 'letter-W')) + scrollY - wTopBefore)).toBeLessThan(2);
});
