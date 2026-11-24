import type { Database } from 'bun:sqlite';
import type { ContactInput } from './contacts.js';
import { createContact } from './contacts.js';
import { openDatabase } from './db.js';

/** A fresh, migrated in-memory database with one test user. */
export function testDatabase(): Database {
	const db = openDatabase(':memory:');
	db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', [
		'test@xenia.local',
		'x', // the contacts tests never check the password
		new Date().toISOString()
	]);
	return db;
}

/** The id of the single user a testDatabase starts with. */
export const TEST_USER_ID = 1;

export function addContact(db: Database, overrides: Partial<ContactInput> = {}) {
	return createContact(db, TEST_USER_ID, {
		groupName: 'Friends',
		location: 'Basel',
		phoneNumber: '+41 79 123 45 67',
		...overrides
	});
}
