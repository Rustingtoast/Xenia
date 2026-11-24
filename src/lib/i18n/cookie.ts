// The language cookie, written by the browser (the server reads it on every request: hooks.server.ts).
// Browser-only: these use document.cookie.
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale, type Locale } from './index.js';

/** Remembers the language in this browser for a year from now. */
export function saveLocale(locale: Locale): void {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/** The language picked in this browser (saved by a language menu), or null if none or no longer supported. */
export function savedLocale(): Locale | null {
	for (const cookie of document.cookie.split(';')) {
		const [name, value] = cookie.trim().split('=');
		if (name === LOCALE_COOKIE) return isLocale(value) ? value : null;
	}
	return null;
}
