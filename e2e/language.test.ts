import { expect, test, type Page } from '@playwright/test';
import { COOKIE_NOTICE_DISMISSED, ENGLISH_COOKIE, setContacts } from './support.ts';

const savedLocale = async (page: Page) => (await page.context().cookies()).find((cookie) => cookie.name === 'locale')?.value;

test('picking a language in Settings translates the page in place and is remembered', async ({ page }) => {
	setContacts();
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');

	await page.getByRole('complementary', { name: 'Group list' }).getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Language' }).selectOption('de');

	// The open dialog and the page behind it switch without a reload.
	const dialog = page.getByRole('dialog', { name: 'Einstellungen' });
	await expect(dialog.getByRole('combobox', { name: 'Sprache' })).toHaveValue('de');
	await expect(page.getByRole('heading', { name: 'Telefonbuch', level: 1 })).toBeVisible();
	await expect(page.locator('#contact-count')).toHaveText('4 Kontakte');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	expect(await savedLocale(page)).toBe('de');

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Telefonbuch', level: 1 })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de'); // rendered by the server in the saved language
	await expect(page).toHaveTitle('Telefonbuch · Xenia');
});

test('the picked language is renewed on every visit, so the browser keeps the last one used', async ({ page }) => {
	const inAnHour = Math.floor(Date.now() / 1000) + 3600;
	await page.context().addCookies([{ ...ENGLISH_COOKIE, value: 'it', expires: inAnHour }]);
	setContacts();
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Rubrica', level: 1 })).toBeVisible();
	const savedFor = async () => (await page.context().cookies()).find((cookie) => cookie.name === 'locale')?.expires ?? 0;
	await expect.poll(savedFor).toBeGreaterThan(inAnHour + 300 * 24 * 60 * 60); // a year again
	expect(await savedLocale(page)).toBe('it');
});

test('validation errors come in the page language', async ({ page }) => {
	await page.context().addCookies([{ ...ENGLISH_COOKIE, value: 'es' }]);
	setContacts();
	await page.goto('/');

	await page.getByRole('button', { name: '+ Nuevo' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nuevo contacto' });
	await dialog.getByRole('button', { name: 'Añadir' }).click();
	await expect(dialog.getByText('no puede estar vacío')).toHaveCount(3); // group, location, phone number
});

test('an unknown page shows the error in the page language', async ({ page }) => {
	const response = await page.goto('/does-not-exist');
	expect(response?.status()).toBe(404);
	await expect(page.getByText("This page doesn't exist.")).toBeVisible();

	await page.context().addCookies([{ ...ENGLISH_COOKIE, value: 'fr' }]);
	await page.reload();
	await expect(page.getByText('Cette page n’existe pas.')).toBeVisible();
	await page.getByRole('link', { name: 'Retour à Xenia' }).click();
	await expect(page.getByRole('heading', { name: 'Annuaire', level: 1 })).toBeVisible();
});

test.describe('a first visit', () => {
	// No cookies at all: signed out, no language picked, cookie notice not dismissed.
	test.use({ storageState: { cookies: [], origins: [] } });

	test('the app starts in French, with the cookie notice; one click hides the notice for good', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByRole('heading', { name: 'Se connecter à Xenia' })).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Langue' })).toHaveValue('fr');
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

		const notice = page.getByRole('region', { name: 'Cookies' });
		await expect(notice).toContainText('uniquement des cookies fonctionnels');
		await notice.getByRole('button', { name: 'OK' }).click();
		await expect(notice).toBeHidden();

		await page.reload();
		await expect(page.getByRole('heading', { name: 'Se connecter à Xenia' })).toBeVisible();
		await expect(notice).toHaveCount(0); // not even rendered by the server
	});
});

test.describe('signed out', () => {
	// No session and no language picked (the cookie notice is dismissed).
	test.use({ storageState: { cookies: [COOKIE_NOTICE_DISMISSED], origins: [] } });

	test('the login page has a language menu, and the choice carries over to registering', async ({ page }) => {
		await page.goto('/login');
		await page.getByRole('combobox', { name: 'Langue' }).selectOption('ja');

		await expect(page.getByRole('heading', { name: 'Xenia にログイン' })).toBeVisible();
		await expect(page.getByLabel('パスワード')).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

		await page.getByRole('link', { name: '登録' }).click();
		await expect(page.getByRole('heading', { name: 'アカウントを作成' })).toBeVisible();
		await expect(page.getByRole('combobox', { name: '言語' })).toHaveValue('ja');

		// Server messages too: a wrong password, back on the login page.
		await page.getByRole('link', { name: 'ログイン' }).click();
		await page.getByLabel('メールアドレス').fill('nobody@xenia.local');
		await page.getByLabel('パスワード').fill('wrong-password');
		await page.getByRole('button', { name: 'ログイン' }).click();
		await expect(page.getByText('メールアドレスまたはパスワードが正しくありません。')).toBeVisible();
	});
});
