// Translations, shared by the server and the browser. The messages themselves live in ./messages/ (one file
// per language, English is the reference); components translate with `t` from ./t.ts.
import type { en } from './messages/en.js';

/** The languages the app speaks. Values are BCP 47 language tags (cookie value, <html lang>, Intl). */
export enum Locale {
	// In the order the language menu lists them: alphabetical by the language's own name.
	German = 'de',
	English = 'en',
	Spanish = 'es',
	French = 'fr',
	Icelandic = 'is',
	Italian = 'it',
	Dutch = 'nl',
	Norwegian = 'nb',
	Finnish = 'fi',
	Russian = 'ru',
	Hindi = 'hi',
	Chinese = 'zh',
	Japanese = 'ja'
}

/** Each language's name in that language, as the language menu shows it. */
export const LOCALE_NAMES: Record<Locale, string> = {
	[Locale.German]: 'Deutsch',
	[Locale.English]: 'English',
	[Locale.Spanish]: 'Español',
	[Locale.French]: 'Français',
	[Locale.Icelandic]: 'Íslenska',
	[Locale.Italian]: 'Italiano',
	[Locale.Dutch]: 'Nederlands',
	[Locale.Norwegian]: 'Norsk bokmål',
	[Locale.Finnish]: 'Suomi',
	[Locale.Russian]: 'Русский',
	[Locale.Hindi]: 'हिन्दी',
	[Locale.Chinese]: '中文',
	[Locale.Japanese]: '日本語'
};

/** The language until someone picks another one (in Settings or on the login page). */
export const DEFAULT_LOCALE = Locale.French;

/** The cookie that remembers the language picked in Settings. */
export const LOCALE_COOKIE = 'locale';
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year, in seconds

/** invalidate() this after changing the language: the root layout reloads the messages. */
export const LOCALE_DEPENDENCY = 'app:locale';

const LOCALES = new Set<string>(Object.values(Locale));

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && LOCALES.has(value);
}

/** The page's language: the one picked (saved in the cookie), else the default. */
export function resolveLocale(cookie: string | undefined): Locale {
	return isLocale(cookie) ? cookie : DEFAULT_LOCALE;
}

/**
 * A message that depends on a number: one text per plural category of the language
 * (English: one/other; Russian: one/few/many/other; Chinese: other only). Selected by the `count` parameter.
 */
export type Plural = { other: string } & Partial<Record<Exclude<Intl.LDMLPluralRule, 'other'>, string>>;
export type Message = string | Plural;

/** Every message key, e.g. 'phonebook.title'. English (./messages/en.ts) defines them. */
export type MessageKey = keyof typeof en;

/** All messages of one language: the same keys as English, plural where English is plural. */
export type Dictionary = { [K in MessageKey]: (typeof en)[K] extends string ? string : Plural };

/** Values for a message's {placeholders}. `count` also picks the plural form. */
export type MessageParams = Record<string, string | number>;

/** A message to be shown in the reader's language, e.g. a validation error the server sends to the page. */
export type Translatable = { key: MessageKey; params?: MessageParams };

export function message(key: MessageKey, params?: MessageParams): Translatable {
	return params ? { key, params } : { key };
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
	let rules = pluralRules.get(locale);
	if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
	return rules.select(count);
}

/** The text of a message, with its {placeholders} filled in. Unknown placeholders are left as they are. */
export function translate(messages: Dictionary, locale: Locale, key: MessageKey, params: MessageParams = {}): string {
	const message: Message | undefined = messages[key];
	if (message === undefined) return key;
	const text =
		typeof message === 'string' ? message : (message[pluralCategory(locale, Number(params.count ?? 0))] ?? message.other);
	return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : placeholder
	);
}

/** The {placeholder} names in a text, e.g. ["matches", "count"]. */
export function placeholders(text: string): string[] {
	return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
}
