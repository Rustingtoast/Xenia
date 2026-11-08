import { beforeEach, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { deleteContact, findContact } from './contacts.js';
import { addContact, testDatabase } from './test-helpers.js';
import { UNDO_WINDOW_MS, createUndoToken, readUndoToken, restoreFromUndoToken } from './undo.js';

const SECRET = 'test-secret';
let db: Database;
beforeEach(() => {
	db = testDatabase();
});

test('a deleted contact can be restored from its undo token, with the same id and data', async () => {
	const original = addContact(db, { groupName: 'Family', location: 'Zurich', phoneNumber: '+1 555-0101', description: 'Mum' });
	const token = await createUndoToken(original, SECRET);
	deleteContact(db, original.id);

	const restored = await restoreFromUndoToken(db, token, SECRET);

	expect(restored).toMatchObject({
		id: original.id,
		groupName: 'Family',
		location: 'Zurich',
		phoneNumber: '+1 555-0101',
		description: 'Mum',
		createdAt: original.createdAt
	});
	expect(findContact(db, original.id)).not.toBeNull();
});

test('an undo token works only once', async () => {
	const contact = addContact(db);
	const token = await createUndoToken(contact, SECRET);
	deleteContact(db, contact.id);

	expect(await restoreFromUndoToken(db, token, SECRET)).not.toBeNull();
	expect(await restoreFromUndoToken(db, token, SECRET)).toBeNull();
});

test('an undo token expires', async () => {
	const contact = addContact(db);
	const now = Date.now();
	const token = await createUndoToken(contact, SECRET, now);
	deleteContact(db, contact.id);

	expect(await restoreFromUndoToken(db, token, SECRET, now + UNDO_WINDOW_MS + 1)).toBeNull();
	expect(await restoreFromUndoToken(db, token, SECRET, now + UNDO_WINDOW_MS - 1)).not.toBeNull();
});

test("an undo token can't be read, forged or used with another secret", async () => {
	const contact = addContact(db, { phoneNumber: '555-0101' });
	const token = await createUndoToken(contact, SECRET);

	expect(token).not.toContain('555-0101');
	expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain('555-0101');
	expect(await readUndoToken(token, 'another-secret')).toBeNull();
	const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'AB' : 'AA');
	expect(await readUndoToken(tampered, SECRET)).toBeNull();
	expect(await readUndoToken('forged', SECRET)).toBeNull();
	expect(await readUndoToken('', SECRET)).toBeNull();
});
