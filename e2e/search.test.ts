import { expect, test, type Page } from '@playwright/test';
import { LIST_STICKY_TOP, STANDARD_CONTACTS, groupListEntries, rowField, rowSelector, setContacts } from './support.ts';

// Issue #7: search group, location, phone number and description, highlight the matches.
const CONTACTS = [
	...STANDARD_CONTACTS, // Family/Zurich, Work/Bern, Ärzte/Basel, 112 Emergency/Zurich
	{ groupName: 'Family', location: 'Bern', phoneNumber: '555 0160' },
	{ groupName: 'Bernese Club', location: 'Thun', phoneNumber: '555 0161' }
];

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search contacts' });
const headings = (page: Page) => page.locator('section h2');

/** The request that loads the list for a search (SvelteKit fetches the page's data). */
const loadsSearch = (search: string) => (request: { url(): string }) =>
	request.url().includes('__data.json') && new URL(request.url()).searchParams.get('q') === search;

/** Makes every search take this long to load, like a slow server, so a test can act while one is on its way. */
async function slowSearches(page: Page, ms: number) {
	await page.route(/__data\.json/, async (route) => {
		await new Promise((resolve) => setTimeout(resolve, ms));
		await route.continue();
	});
}

async function deleteContact(page: Page, row: ReturnType<Page['locator']>) {
	await row.getByRole('button', { name: /^Options for/ }).click();
	await row.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog', { name: 'Delete this contact?' }).getByRole('button', { name: 'Delete' }).click();
}

test('typing filters the list, highlights matches and updates counts and the Group list', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/');

	await searchBox(page).fill('bern');

	await expect(page).toHaveURL(/\?q=bern$/);
	await expect(headings(page)).toHaveText(['Bernese Club', 'Family', 'Work']); // group match + location matches
	await expect(page.locator('#contact-count')).toHaveText('3 of 6 contacts');
	await expect(page.getByRole('complementary', { name: 'Group list' }).getByRole('link')).toHaveText(
		groupListEntries(['Bernese Club', 'Family', 'Work'])
	);
	await expect(page.locator('main section li[id^=contact_]')).toHaveCount(3); // only the Bern contact of Family
	await expect(page.locator('main mark').first()).toHaveText('Bern');
	await expect(page.locator('main section h2 mark')).toHaveText(['Bern']); // "Bernese Club" heading
	await expect(searchBox(page)).toBeFocused(); // typing isn't interrupted
});

test('a whole group matches by its name', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/?q=FAM');

	await expect(headings(page)).toHaveText(['Family']);
	await expect(page.locator('main section li[id^=contact_]')).toHaveCount(2);
	await expect(searchBox(page)).toHaveValue('FAM');
});

test('the search survives a reload; clearing it shows everything again', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/');
	await searchBox(page).fill('zurich');
	await expect(page).toHaveURL(/\?q=zurich$/);

	await page.reload();
	await expect(searchBox(page)).toHaveValue('zurich');
	await expect(headings(page)).toHaveText(['112 Emergency', 'Family']);

	await page.getByRole('button', { name: 'Clear search' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(headings(page)).toHaveText(['112 Emergency', 'Bernese Club', 'Family', 'Work', 'Ärzte']);
	await expect(page.locator('#contact-count')).toHaveText('6 contacts');
	await expect(page.locator('main mark')).toHaveCount(0);
	await expect(searchBox(page)).toBeFocused();
});

test('Escape clears the search', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/?q=zurich');
	await searchBox(page).press('Escape');

	await expect(searchBox(page)).toHaveValue('');
	await expect(page).toHaveURL(/\/$/);
});

test('no matches: a clear message and a way back', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/');
	await searchBox(page).fill('nowhere');

	await expect(page.getByText('No contacts match “nowhere”.')).toBeVisible();
	await expect(page.locator('#contact-count')).toHaveText('0 of 6 contacts');
	await expect(page.getByRole('complementary', { name: 'Group list' })).toContainText('No matching groups.');

	await page.getByRole('main').getByRole('button', { name: 'Clear search' }).last().click();
	await expect(headings(page)).toHaveCount(5);
});

test('% and _ are searched literally', async ({ page }) => {
	setContacts([...CONTACTS, { groupName: '100% Club', location: 'Olten', phoneNumber: '555 0162' }]);
	await page.goto('/?q=%25');

	await expect(headings(page)).toHaveText(['100% Club']);
});

test('deleting and undoing while searching keeps the search', async ({ page }) => {
	const contacts = setContacts(CONTACTS);
	const familyBern = contacts[4];
	await page.goto('/?q=bern');
	const row = page.locator(rowSelector(familyBern));

	await deleteContact(page, row);

	await expect(page).toHaveURL(/\?q=bern$/);
	await expect(headings(page)).toHaveText(['Bernese Club', 'Work']);
	await expect(page.locator('#contact-count')).toHaveText('2 of 5 contacts');

	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(headings(page)).toHaveText(['Bernese Club', 'Family', 'Work']);
	await expect(row).toBeVisible();
	await expect(searchBox(page)).toHaveValue('bern');
});

test('finds a phone number typed without its separators, and highlights it', async ({ page }) => {
	const [family] = setContacts(CONTACTS); // Family/Zurich has "+1 555-0101"
	await page.goto('/');
	await searchBox(page).fill('5550101');

	await expect(headings(page)).toHaveText(['Family']);
	const number = page.locator(rowSelector(family)).locator(rowField('phone-number'));
	await expect(number).toHaveText('+1 555-0101');
	await expect(number.locator('mark')).toHaveText('555-0101');
});

test('finds words in the description, highlighted in the list and the details', async ({ page }) => {
	const contacts = setContacts([
		...CONTACTS,
		{ groupName: 'Doctors', location: 'Zurich', phoneNumber: '555-0115', description: 'Dr. Weber, family doctor.\nOpen Mon–Fri.' }
	]);
	const doctor = contacts.at(-1)!;
	await page.goto('/');
	await searchBox(page).fill('weber');

	await expect(headings(page)).toHaveText(['Doctors']);
	const row = page.locator(rowSelector(doctor));
	await expect(row.locator(':scope > div > button mark')).toHaveText('Weber');

	await row.locator(':scope > div > button').click();
	const dialog = page.getByRole('dialog', { name: 'Contact details' });
	await expect(dialog.locator('[data-field="description"] mark')).toHaveText('Weber');
	await dialog.getByRole('button', { name: 'Close' }).click();

	// The list shows the description on one line, so a search can run across its line break.
	await searchBox(page).fill('doctor. open');
	await expect(headings(page)).toHaveText(['Doctors']);
	await expect(row.locator(':scope > div > button mark')).toHaveText('doctor. Open');
});

test('characters typed while a search is still loading are kept', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/');
	await slowSearches(page, 300);

	await searchBox(page).pressSequentially('be');
	await page.waitForRequest(loadsSearch('be')); // typing paused: "be" is on its way
	await page.waitForTimeout(200);
	await searchBox(page).pressSequentially('r'); // "be" arrives right after this key

	await expect(page).toHaveURL(/\?q=ber$/);
	await expect(searchBox(page)).toHaveValue('ber');
	await expect(headings(page)).toHaveText(['Bernese Club', 'Family', 'Work']);
	await expect(page.locator('main section h2 mark')).toHaveText(['Ber']);
});

test('clearing the box while a search is still loading cancels that search', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/');
	await slowSearches(page, 300);

	await searchBox(page).fill('bern');
	const loaded = page.waitForResponse((response) => loadsSearch('bern')(response));
	await page.waitForRequest(loadsSearch('bern'));
	await searchBox(page).press('Escape');
	await expect(searchBox(page)).toHaveValue('');

	await (await loaded).finished();
	await page.waitForTimeout(300); // "bern" has arrived by now, and must not be shown
	await expect(searchBox(page)).toHaveValue('');
	await expect(page).toHaveURL(/\/$/);
	await expect(headings(page)).toHaveCount(5);
	await expect(page.locator('#contact-count')).toHaveText('6 contacts');
});

test('the Undo banner stays while the search changes', async ({ page }) => {
	const contacts = setContacts(CONTACTS);
	const familyBern = contacts[4];
	await page.goto('/?q=bern');
	await deleteContact(page, page.locator(rowSelector(familyBern)));
	await expect(page.getByRole('status')).toContainText('Contact deleted.');

	await searchBox(page).fill('zurich'); // look somewhere else …
	await expect(headings(page)).toHaveText(['112 Emergency', 'Family']);
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click(); // … and still undo

	await expect(page.getByRole('status')).toHaveText('Contact restored.');
	await expect(page).toHaveURL(/\?q=zurich$/);
	await expect(page.locator('#contact-count')).toHaveText('2 of 6 contacts');
	await searchBox(page).fill('bern');
	await expect(page.locator(rowSelector(familyBern))).toBeVisible();
});

test('a new search shows its results from the first match, wherever the list was scrolled to', async ({ page }) => {
	const towns = setContacts(
		Array.from({ length: 400 }, (_, i) => {
			const number = String(i).padStart(3, '0');
			return { groupName: 'Towns', location: `Town ${number}`, phoneNumber: `555 0${number}` };
		})
	);
	await page.goto('/');
	await page.evaluate(() => window.scrollTo(0, 12000));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(12000);

	await searchBox(page).fill('town');
	await expect(page).toHaveURL(/\?q=town$/);

	// The first match sits just below the search bar, column titles and group heading; the bar hasn't moved.
	const first = page.locator(rowSelector(towns[0]));
	await expect(first).toBeInViewport();
	const top = (await first.boundingBox())!.y;
	expect(top).toBeGreaterThanOrEqual(LIST_STICKY_TOP);
	expect(top).toBeLessThan(LIST_STICKY_TOP + 100);
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await expect(searchBox(page)).toBeFocused();
});

test('searching drops the #group-… that a jump from the Group list left in the address', async ({ page }) => {
	setContacts(CONTACTS);
	await page.goto('/');
	await page.getByRole('complementary', { name: 'Group list' }).getByRole('link', { name: /Family/ }).click();
	await expect(page).toHaveURL(/#group-family-/);

	await searchBox(page).fill('bern');
	await expect(page).toHaveURL(/\/\?q=bern$/);
	await page.getByRole('button', { name: 'Clear search' }).click();
	await expect(page).toHaveURL(/\/$/);
});
