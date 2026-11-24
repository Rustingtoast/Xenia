// The language cookie, written by the browser (the server reads it on every request: hooks.server.ts).
// Browser-only: these use document.cookie.
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from './index.js';

/** Remembers the language in this browser for a year from now. */
export function saveLocale(locale: Locale): void {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/** Whether a language was picked in this browser (a language menu saved one). */
export function hasSavedLocale(): boolean {
	return document.cookie.split(';').some((cookie) => cookie.trim().startsWith(`${LOCALE_COOKIE}=`));
}
