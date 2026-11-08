import type { Database } from 'bun:sqlite';
import type { ContactInput } from './contacts.js';
import { createContact } from './contacts.js';
import { openDatabase } from './db.js';

/** A fresh, migrated in-memory database. */
export function testDatabase(): Database {
	return openDatabase(':memory:');
}

export function addContact(db: Database, overrides: Partial<ContactInput> = {}) {
	return createContact(db, { groupName: 'Friends', location: 'Basel', phoneNumber: '+41 79 123 45 67', ...overrides });
}
