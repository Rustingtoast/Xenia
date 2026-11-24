import { describe, expect, test } from 'bun:test';
import { MESSAGES } from '../server/messages.js';
import {
	DEFAULT_LOCALE,
	LOCALE_NAMES,
	Locale,
	isLocale,
	message,
	placeholders,
	resolveLocale,
	translate,
	type Message,
	type MessageKey
} from './index.js';
import { en } from './messages/en.js';

const KEYS = Object.keys(en).sort() as MessageKey[];

/** Every text of a message: the string, or each plural form. */
function texts(message: Message): string[] {
	return typeof message === 'string' ? [message] : Object.values(message);
}

describe('resolveLocale', () => {
	test('uses the language saved in the cookie', () => {
		expect(resolveLocale('de')).toBe(Locale.German);
		expect(resolveLocale('ja')).toBe(Locale.Japanese);
		expect(resolveLocale('zh-Hans')).toBe(Locale.Chinese);
	});

	test('falls back to French without a valid choice', () => {
		expect(DEFAULT_LOCALE).toBe(Locale.French);
		expect(resolveLocale(undefined)).toBe(Locale.French);
		expect(resolveLocale('')).toBe(Locale.French);
		expect(resolveLocale('xx')).toBe(Locale.French);
		expect(resolveLocale('DE')).toBe(Locale.French); // values are exact, as the menu writes them
	});

	test('isLocale accepts only supported languages', () => {
		expect(isLocale('fr')).toBe(true);
		expect(isLocale('pt')).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});

describe('translate', () => {
	test('fills in placeholders', () => {
		expect(translate(en, Locale.English, 'contact.optionsFor', { phoneNumber: '+1 555-0101' })).toBe(
			'Options for +1 555-0101'
		);
		expect(translate(MESSAGES.de, Locale.German, 'phonebook.noMatches', { search: 'bern' })).toBe(
			'Keine Kontakte passen zu „bern“.'
		);
	});

	test('leaves a placeholder without a value as it is', () => {
		expect(translate(en, Locale.English, 'contact.optionsFor')).toBe('Options for {phoneNumber}');
	});

	test('picks the plural form by count', () => {
		expect(translate(en, Locale.English, 'phonebook.count', { count: 1 })).toBe('1 contact');
		expect(translate(en, Locale.English, 'phonebook.count', { count: 0 })).toBe('0 contacts');
		expect(translate(en, Locale.English, 'phonebook.matchCount', { matches: 2, count: 25 })).toBe('2 of 25 contacts');
		expect(translate(MESSAGES.fr, Locale.French, 'phonebook.count', { count: 0 })).toBe('0 contact'); // 0 is singular in French
		expect(translate(MESSAGES.ru, Locale.Russian, 'phonebook.count', { count: 21 })).toBe('21 контакт');
		expect(translate(MESSAGES.ru, Locale.Russian, 'phonebook.count', { count: 3 })).toBe('3 контакта');
		expect(translate(MESSAGES.ru, Locale.Russian, 'phonebook.count', { count: 11 })).toBe('11 контактов');
		expect(translate(MESSAGES[Locale.Chinese], Locale.Chinese, 'phonebook.count', { count: 1 })).toBe('1 个联系人');
	});

	test('writes numbers the way the language does; text parameters stay as they are', () => {
		expect(translate(en, Locale.English, 'phonebook.count', { count: 1234 })).toBe('1,234 contacts');
		expect(translate(MESSAGES.de, Locale.German, 'phonebook.count', { count: 1234 })).toBe('1.234 Kontakte');
		expect(translate(en, Locale.English, 'validation.tooLong', { max: 1000 })).toBe(
			'is too long (maximum is 1,000 characters)'
		);
		expect(translate(en, Locale.English, 'phonebook.noMatches', { search: '1234' })).toBe('No contacts match “1234”.');
	});

	test('translates a message the server sent', () => {
		const error = message('register.passwordTooShort', { min: 8 });
		expect(translate(MESSAGES.fr, Locale.French, error.key, error.params)).toBe('Utilisez au moins 8 caractères.');
	});
});

describe('every language', () => {
	const locales = Object.values(Locale);

	test('has messages and a name', () => {
		for (const locale of locales) {
			expect(MESSAGES[locale]).toBeDefined();
			expect(LOCALE_NAMES[locale]).toBeTruthy();
		}
	});

	test.each(locales)('%s has exactly the English keys, none empty', (locale) => {
		const messages = MESSAGES[locale];
		expect(Object.keys(messages).sort()).toEqual(KEYS);
		for (const key of KEYS) {
			for (const text of texts(messages[key])) expect(text.trim()).not.toBe('');
		}
	});

	test.each(locales)('%s uses the same placeholders as English', (locale) => {
		for (const key of KEYS) {
			const expected = new Set(texts(en[key]).flatMap(placeholders));
			for (const text of texts(MESSAGES[locale][key])) {
				expect({ key, placeholders: new Set(placeholders(text)) }).toEqual({ key, placeholders: expected });
			}
		}
	});

	test.each(locales)('%s has every plural form the language needs', (locale) => {
		const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
		for (const key of KEYS) {
			const message: Message = MESSAGES[locale][key];
			// Plural exactly where English is plural.
			expect({ key, plural: typeof message !== 'string' }).toEqual({ key, plural: typeof en[key] !== 'string' });
			if (typeof message === 'string') continue;
			for (const category of categories) expect({ key, [category]: message[category] }).toEqual({ key, [category]: expect.any(String) });
		}
	});
});
