import { execFileSync } from 'node:child_process';
import type { Contact } from '../src/lib/contacts.ts';
import type { ContactInput } from '../src/lib/server/contacts.ts';
import { E2E_DATABASE_PATH } from '../playwright.config.ts';

/** The standard test contacts: four groups, one contact each. */
export const STANDARD_CONTACTS: ContactInput[] = [
	{ groupName: 'Family', location: 'Zurich', phoneNumber: '+1 555-0101' },
	{ groupName: 'Work', location: 'Bern', phoneNumber: '(555) 010-0113' },
	{ groupName: 'Ärzte', location: 'Basel', phoneNumber: '555 0130' },
	{ groupName: '112 Emergency', location: 'Zurich', phoneNumber: '112' }
];

/** Replaces every contact in the e2e database. Returns the created contacts. */
export function setContacts(contacts: ContactInput[] = STANDARD_CONTACTS): Contact[] {
	const output = execFileSync('bun', ['e2e/set-contacts.ts'], {
		input: JSON.stringify(contacts),
		env: { ...process.env, DATABASE_PATH: E2E_DATABASE_PATH },
		encoding: 'utf8'
	});
	return JSON.parse(output);
}

export function rowSelector(contact: Contact): string {
	return `#contact_${contact.id}`;
}

/** A field as shown in the list row itself (not in the row's details dialog). */
export function rowField(field: 'phone-number' | 'location'): string {
	return `:scope > div > [data-field="${field}"]`;
}

/** Matches Group list entries ("Family 2") by group name, in order. */
export function groupListEntries(names: string[]): RegExp[] {
	return names.map((name) => new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\d+\\s*$`));
}

function browserCookie(name: string, value: string) {
	return { name, value, domain: '127.0.0.1', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const };
}

/** The tests read English text, but the app starts in French: English is picked in every test browser. */
export const ENGLISH_COOKIE = browserCookie('locale', 'en');
/** The cookie notice is dismissed, so it doesn't cover buttons at the bottom of the screen. */
export const COOKIE_NOTICE_DISMISSED = browserCookie('cookie-notice', 'dismissed');
/** What global-setup.ts puts in the shared storage state besides the session. Tests about these drop them. */
export const PREFERENCE_COOKIES = [ENGLISH_COOKIE, COOKIE_NOTICE_DISMISSED];

/** Top bar (64px) + sticky search bar (56px): group headings stick and jumps stop just below this. */
export const LIST_STICKY_TOP = 120;
