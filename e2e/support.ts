import { execFileSync } from 'node:child_process';
import type { Contact } from '../src/lib/contacts.ts';
import type { ContactInput } from '../src/lib/server/contacts.ts';
import { E2E_DATABASE_PATH } from '../playwright.config.ts';

/** The standard test contacts: one per letter section A, F, W and "#". */
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
