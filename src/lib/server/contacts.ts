import type { Database } from 'bun:sqlite';
import { INDEX_LETTERS, SECTION_CHUNK_SIZE, indexLetterFor, type Contact } from '../contacts.js';

/** What a user enters for a contact. */
export type ContactInput = { groupName: string; location: string; phoneNumber: string };

/** Field → error messages. Empty when valid. */
export type ValidationErrors = Partial<Record<keyof ContactInput, string[]>>;

export class ContactValidationError extends Error {
	constructor(readonly errors: ValidationErrors) {
		super(`Invalid contact: ${JSON.stringify(errors)}`);
	}
}

/** A contact's place in the list order: [group, location, phone, id]. Chunks continue after one. */
export type ListPosition = [string, string, string, number];

// Digits plus the separators people actually type: "+41 79 123 45 67", "(555) 010-0199", "044/123.45.67".
const PHONE_FORMAT = /^\+?[0-9 ()./-]+$/;

const SELECT_CONTACT = `
	SELECT id, group_name AS groupName, location, phone_number AS phoneNumber,
	       index_letter AS indexLetter, created_at AS createdAt, updated_at AS updatedAt
	FROM contacts`;

// List order. group_name and location are NOCASE columns; with index_letter this is exactly
// the contacts_letter_section_order index (+ the row id).
const LIST_ORDER = 'ORDER BY group_name, location, phone_number, id';
const AFTER_POSITION = '(group_name, location, phone_number, id) > (?, ?, ?, ?)';

/** Trims and collapses repeated spaces: "  New   York " → "New York". */
export function normalize(value: string): string {
	return value.trim().replace(/ {2,}/g, ' ');
}

/** Normalizes the input and checks it. Returns the clean values and any errors. */
export function validateContact(input: ContactInput): { values: ContactInput; errors: ValidationErrors } {
	const values = {
		groupName: normalize(input.groupName ?? ''),
		location: normalize(input.location ?? ''),
		phoneNumber: normalize(input.phoneNumber ?? '')
	};
	const errors: ValidationErrors = {};
	const add = (field: keyof ContactInput, message: string) => (errors[field] ??= []).push(message);

	for (const field of ['groupName', 'location'] as const) {
		if (!values[field]) add(field, "can't be blank");
		else if (values[field].length > 100) add(field, 'is too long (maximum is 100 characters)');
	}
	const phone = values.phoneNumber;
	if (!phone) add('phoneNumber', "can't be blank");
	else {
		if (phone.length > 30) add('phoneNumber', 'is too long (maximum is 30 characters)');
		if (!PHONE_FORMAT.test(phone)) add('phoneNumber', 'may only contain digits, spaces, + ( ) . / -');
		if ((phone.match(/[0-9]/g) ?? []).length < 3) add('phoneNumber', 'must contain at least 3 digits');
	}
	return { values, errors };
}

/**
 * Creates a contact. Throws ContactValidationError if the input is invalid.
 * `id` and `createdAt` are only for restoring a deleted contact (undo).
 */
export function createContact(
	db: Database,
	input: ContactInput,
	restore: { id?: number; createdAt?: string } = {}
): Contact {
	const { values, errors } = validateContact(input);
	if (Object.keys(errors).length > 0) throw new ContactValidationError(errors);

	const now = new Date().toISOString();
	const row = db
		.query<{ id: number }, (string | number | null)[]>(
			`INSERT INTO contacts (id, group_name, location, phone_number, index_letter, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
		)
		.get(
			restore.id ?? null,
			values.groupName,
			values.location,
			values.phoneNumber,
			indexLetterFor(values.groupName),
			restore.createdAt ?? now,
			now
		)!;
	return findContact(db, row.id)!;
}

export function findContact(db: Database, id: number): Contact | null {
	return db.query<Contact, [number]>(`${SELECT_CONTACT} WHERE id = ?`).get(id);
}

/** Deletes a contact. Returns it, or null if it didn't exist. */
export function deleteContact(db: Database, id: number): Contact | null {
	return db.query<Contact, [number]>(
		`DELETE FROM contacts WHERE id = ?
		 RETURNING id, group_name AS groupName, location, phone_number AS phoneNumber,
		           index_letter AS indexLetter, created_at AS createdAt, updated_at AS updatedAt`
	).get(id);
}

/** Number of contacts per side-index letter, in A–Z order with "#" last: [["D", 2], ["F", 9], ["#", 1]]. */
export function letterCounts(db: Database): [string, number][] {
	const rows = db
		.query<{ letter: string; count: number }, []>(
			'SELECT index_letter AS letter, COUNT(*) AS count FROM contacts GROUP BY index_letter'
		)
		.all();
	return rows
		.map((row): [string, number] => [row.letter, row.count])
		.sort(([a], [b]) => INDEX_LETTERS.indexOf(a as never) - INDEX_LETTERS.indexOf(b as never));
}

/** A contact's place in the list order, for continuing a section after it. */
export function listPosition(contact: Contact): ListPosition {
	return [contact.groupName, contact.location, contact.phoneNumber, contact.id];
}

/**
 * One chunk of a letter section in list order, continuing after `after` (from the start if omitted).
 * Continuing "after X" rather than "skip N" means deleting a contact never shifts the next chunk
 * and hides someone. `remaining` counts the contacts after this chunk.
 */
export function sectionChunk(
	db: Database,
	letter: string,
	after?: ListPosition,
	limit = SECTION_CHUNK_SIZE
): { contacts: Contact[]; more: boolean; remaining: number } {
	const where = after ? `WHERE index_letter = ? AND ${AFTER_POSITION}` : 'WHERE index_letter = ?';
	const params = after ? [letter, ...after] : [letter];
	const rows = db
		.query<Contact, (string | number)[]>(`${SELECT_CONTACT} ${where} ${LIST_ORDER} LIMIT ?`)
		.all(...params, limit + 1);
	const contacts = rows.slice(0, limit);
	const more = rows.length > limit;
	const remaining = more ? countInSection(db, letter, listPosition(contacts.at(-1)!)) : 0;
	return { contacts, more, remaining };
}

/** Contacts in a letter section, optionally only those after a list position. */
export function countInSection(db: Database, letter: string, after?: ListPosition): number {
	const where = after ? `WHERE index_letter = ? AND ${AFTER_POSITION}` : 'WHERE index_letter = ?';
	const params = after ? [letter, ...after] : [letter];
	return db.query<{ n: number }, (string | number)[]>(`SELECT COUNT(*) AS n FROM contacts ${where}`).get(...params)!.n;
}

/** URL-safe string for a list position (used as the `after` query parameter). */
export function encodeListPosition(position: ListPosition): string {
	return Buffer.from(JSON.stringify(position)).toString('base64url');
}

/** Inverse of encodeListPosition; null if it isn't a valid position. */
export function decodeListPosition(value: string): ListPosition | null {
	try {
		const position: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
		if (
			Array.isArray(position) &&
			position.length === 4 &&
			position.slice(0, 3).every((part) => typeof part === 'string') &&
			Number.isInteger(position[3])
		) {
			return position as ListPosition;
		}
	} catch {
		// fall through
	}
	return null;
}
