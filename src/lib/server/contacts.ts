import type { Database } from 'bun:sqlite';
import { SECTION_CHUNK_SIZE, type Contact, type GroupCount } from '../contacts.js';

/** What a user enters for a contact. */
export type ContactInput = { groupName: string; location: string; phoneNumber: string; description?: string };

/** Longest allowed description (characters). */
export const DESCRIPTION_MAX_LENGTH = 1000;

/** Field → error messages. Empty when valid. */
export type ValidationErrors = Partial<Record<keyof ContactInput, string[]>>;

export class ContactValidationError extends Error {
	constructor(readonly errors: ValidationErrors) {
		super(`Invalid contact: ${JSON.stringify(errors)}`);
	}
}

/** A contact's place in its group's list order: [location, phone, id]. Chunks continue after one. */
export type ListPosition = [string, string, number];

// Digits plus the separators people actually type: "+41 79 123 45 67", "(555) 010-0199", "044/123.45.67".
const PHONE_FORMAT = /^\+?[0-9 ()./-]+$/;

const SELECT_CONTACT = `
	SELECT id, group_name AS groupName, location, phone_number AS phoneNumber, description,
	       created_at AS createdAt, updated_at AS updatedAt
	FROM contacts`;

// Order within a group. group_name and location are NOCASE columns; with `group_name = ?` this is
// exactly the contacts_group_order index (+ the row id).
const GROUP_ORDER = 'ORDER BY location, phone_number, id';
const AFTER_POSITION = '(location, phone_number, id) > (?, ?, ?)';

/** Trims and collapses repeated spaces: "  New   York " → "New York". */
export function normalize(value: string): string {
	return value.trim().replace(/ {2,}/g, ' ');
}

/** Normalizes the input and checks it. Returns the clean values and any errors. */
export function validateContact(input: ContactInput): { values: Required<ContactInput>; errors: ValidationErrors } {
	const values = {
		groupName: normalize(input.groupName ?? ''),
		location: normalize(input.location ?? ''),
		phoneNumber: normalize(input.phoneNumber ?? ''),
		// Only trimmed: line breaks and spacing inside are the user's.
		description: (input.description ?? '').trim()
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
	if (values.description.length > DESCRIPTION_MAX_LENGTH) {
		add('description', `is too long (maximum is ${DESCRIPTION_MAX_LENGTH} characters)`);
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
			`INSERT INTO contacts (id, group_name, location, phone_number, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
		)
		.get(
			restore.id ?? null,
			values.groupName,
			values.location,
			values.phoneNumber,
			values.description,
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
		 RETURNING id, group_name AS groupName, location, phone_number AS phoneNumber, description,
		           created_at AS createdAt, updated_at AS updatedAt`
	).get(id);
}

/**
 * Every group with its number of contacts, in list order: [{ name: "Doctors", count: 2 }, …].
 * "family" and "Family" are one group (NOCASE); the name shown is the capitalized spelling if any.
 */
export function groupCounts(db: Database): GroupCount[] {
	return db
		.query<GroupCount, []>(
			`SELECT MIN(group_name COLLATE BINARY) AS name, COUNT(*) AS count
			 FROM contacts GROUP BY group_name ORDER BY group_name`
		)
		.all();
}

/** A contact's place in its group's list order, for continuing a section after it. */
export function listPosition(contact: Contact): ListPosition {
	return [contact.location, contact.phoneNumber, contact.id];
}

/**
 * One chunk of a group's contacts in list order, continuing after `after` (from the start if omitted).
 * Continuing "after X" rather than "skip N" means deleting a contact never shifts the next chunk
 * and hides someone. `remaining` counts the contacts after this chunk.
 */
export function sectionChunk(
	db: Database,
	groupName: string,
	after?: ListPosition,
	limit = SECTION_CHUNK_SIZE
): { contacts: Contact[]; more: boolean; remaining: number } {
	const where = after ? `WHERE group_name = ? AND ${AFTER_POSITION}` : 'WHERE group_name = ?';
	const params = after ? [groupName, ...after] : [groupName];
	const rows = db
		.query<Contact, (string | number)[]>(`${SELECT_CONTACT} ${where} ${GROUP_ORDER} LIMIT ?`)
		.all(...params, limit + 1);
	const contacts = rows.slice(0, limit);
	const more = rows.length > limit;
	const remaining = more ? countInGroup(db, groupName, listPosition(contacts.at(-1)!)) : 0;
	return { contacts, more, remaining };
}

/** Contacts in a group, optionally only those after a list position. */
export function countInGroup(db: Database, groupName: string, after?: ListPosition): number {
	const where = after ? `WHERE group_name = ? AND ${AFTER_POSITION}` : 'WHERE group_name = ?';
	const params = after ? [groupName, ...after] : [groupName];
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
			position.length === 3 &&
			typeof position[0] === 'string' &&
			typeof position[1] === 'string' &&
			Number.isInteger(position[2])
		) {
			return position as ListPosition;
		}
	} catch {
		// fall through
	}
	return null;
}
