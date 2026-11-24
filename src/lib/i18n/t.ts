// `t` for components: translates into the page's language. The root layout (routes/+layout.server.ts)
// loads the language and only its messages, so the browser never downloads the other languages.
// Reads `page.data`, so text re-renders by itself when the language changes in Settings.
import { page } from '$app/state';
import { DEFAULT_LOCALE, translate, type Dictionary, type Locale, type MessageKey, type MessageParams, type Translatable } from './index.js';

type LocaleData = { locale?: Locale; messages?: Dictionary };

/** The page's language. */
export function locale(): Locale {
	return (page.data as LocaleData).locale ?? DEFAULT_LOCALE;
}

/** A message in the page's language: t('phonebook.count', { count: 3 }), or a message the server sent. */
export function t(message: MessageKey | Translatable, params?: MessageParams): string {
	const { key, params: ownParams } = typeof message === 'string' ? { key: message, params } : message;
	const { locale = DEFAULT_LOCALE, messages } = page.data as LocaleData;
	// No messages only if the root layout failed to load (an error page): show the key rather than nothing.
	return messages ? translate(messages, locale, key, ownParams) : key;
}
