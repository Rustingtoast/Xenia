import { beforeEach, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { deleteContact, findContact } from './contacts.js';
import { TEST_USER_ID, addContact, testDatabase } from './test-helpers.js';
import { UNDO_WINDOW_MS, createUndoToken, readUndoToken, restoreFromUndoToken } from './undo.js';

const SECRET = 'test-secret';
let db: Database;
beforeEach(() => {
	db = testDatabase();
});

test('a deleted contact can be restored from its undo token, with the same id and data', async () => {
	const original = addContact(db, { groupName: 'Family', location: 'Zurich', phoneNumber: '+1 555-0101', description: 'Mum' });
	const token = await createUndoToken(original, TEST_USER_ID, SECRET);
	deleteContact(db, TEST_USER_ID, original.id);

	const restored = await restoreFromUndoToken(db, token, SECRET, TEST_USER_ID);

	expect(restored).toMatchObject({
		id: original.id,
		groupName: 'Family',
		location: 'Zurich',
		phoneNumber: '+1 555-0101',
		description: 'Mum',
		createdAt: original.createdAt
	});
	expect(findContact(db, TEST_USER_ID, original.id)).not.toBeNull();
});

test('an undo token works only once', async () => {
	const contact = addContact(db);
	const token = await createUndoToken(contact, TEST_USER_ID, SECRET);
	deleteContact(db, TEST_USER_ID, contact.id);

	expect(await restoreFromUndoToken(db, token, SECRET, TEST_USER_ID)).not.toBeNull();
	expect(await restoreFromUndoToken(db, token, SECRET, TEST_USER_ID)).toBeNull();
});

test('an undo token expires', async () => {
	const contact = addContact(db);
	const now = Date.now();
	const token = await createUndoToken(contact, TEST_USER_ID, SECRET, now);
	deleteContact(db, TEST_USER_ID, contact.id);

	expect(await restoreFromUndoToken(db, token, SECRET, TEST_USER_ID, now + UNDO_WINDOW_MS + 1)).toBeNull();
	expect(await restoreFromUndoToken(db, token, SECRET, TEST_USER_ID, now + UNDO_WINDOW_MS - 1)).not.toBeNull();
});

test("an undo token can't restore another user's contact", async () => {
	const contact = addContact(db);
	const token = await createUndoToken(contact, TEST_USER_ID, SECRET);
	deleteContact(db, TEST_USER_ID, contact.id);

	// The same token presented by a different user is rejected.
	expect(await restoreFromUndoToken(db, token, SECRET, TEST_USER_ID + 1)).toBeNull();
	expect(findContact(db, TEST_USER_ID, contact.id)).toBeNull();
});

test("an undo token can't be read, forged or used with another secret", async () => {
	const contact = addContact(db, { phoneNumber: '555-0101' });
	const token = await createUndoToken(contact, TEST_USER_ID, SECRET);

	expect(token).not.toContain('555-0101');
	expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain('555-0101');
	expect(await readUndoToken(token, 'another-secret')).toBeNull();
	const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'AB' : 'AA');
	expect(await readUndoToken(tampered, SECRET)).toBeNull();
	expect(await readUndoToken('forged', SECRET)).toBeNull();
	expect(await readUndoToken('', SECRET)).toBeNull();
});
