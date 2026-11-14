import type { Database } from 'bun:sqlite';
import {
	PHONE_FORMAT,
	PHONE_SEPARATORS,
	SECTION_CHUNK_SIZE,
	SPACE_LIKE,
	compactPhoneSearch,
	normalizeSearch,
	type Contact,
	type GroupCount
} from '../contacts.js';

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

const SELECT_CONTACT = `
	SELECT id, group_name AS groupName, location, phone_number AS phoneNumber, description,
	       created_at AS createdAt, updated_at AS updatedAt
	FROM contacts`;

// Order within a group. group_name and location are NOCASE columns; with `group_name = ?` this is
// exactly the contacts_group_order index (+ the row id).
const GROUP_ORDER = 'ORDER BY location, phone_number, id';
const AFTER_POSITION = '(location, phone_number, id) > (?, ?, ?)';

/** A character as an SQL expression, e.g. char(10) for a line break: nothing to quote or escape. */
const sqlChar = (char: string) => `char(${char.charCodeAt(0)})`;

// The description as the list shows it on one line: every run of spaces, tabs and line breaks is one space.
// Descriptions are stored as typed, but a search must be able to span a line break ("doctor. open").
const DESCRIPTION_ONE_LINE = (() => {
	// 1. Tabs and line breaks become spaces.
	const spaced = SPACE_LIKE.reduce((sql, char) => `REPLACE(${sql}, ${sqlChar(char)}, ' ')`, 'description');
	// 2. Runs of spaces become one space: every space becomes "<>", every "><" (two spaces in a row) is
	//    dropped, and what is left of "<>" becomes a space again. Two of the characters replaced in step 1
	//    serve as "<" and ">": after it the text has none of its own.
	const [open, close] = SPACE_LIKE.map(sqlChar);
	return `REPLACE(REPLACE(REPLACE(${spaced}, ' ', ${open} || ${close}), ${close} || ${open}, ''), ${open} || ${close}, ' ')`;
})();
// Search: the text appears in any of these fields. LIKE ignores A–Z case, like NOCASE.
const SEARCHED_FIELDS = ['group_name', 'location', 'phone_number', DESCRIPTION_ONE_LINE];
// The phone number without its separators, so "5550101" finds "+1 555-0101" (see compactPhoneSearch).
const PHONE_COMPACT = PHONE_SEPARATORS.reduce((sql, char) => `REPLACE(${sql}, ${sqlChar(char)}, '')`, 'phone_number');

/** LIKE pattern for "contains", with %, _ and \ in the search taken literally. */
function containsPattern(search: string): string {
	return `%${search.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * "This contact matches the search" as an SQL condition; null without a search. The one definition behind
 * every list query, so counts, chunks and "remaining" always agree.
 */
function searchCondition(search: string): { sql: string; params: string[] } | null {
	const text = normalizeSearch(search);
	if (!text) return null;
	const matches = SEARCHED_FIELDS.map((field) => `${field} LIKE ? ESCAPE '\\'`);
	const params = SEARCHED_FIELDS.map(() => containsPattern(text));
	const compact = compactPhoneSearch(text);
	if (compact) {
		matches.push(`${PHONE_COMPACT} LIKE ?`);
		params.push(`%${compact}%`); // digits and "+" only: nothing to escape
	}
	return { sql: `(${matches.join(' OR ')})`, params };
}

/**
 * The WHERE clause of the chunk queries: one group, optionally only contacts after a list position and/or
 * matching a search.
 */
function listFilter(filter: { userId: number; groupName: string; after?: ListPosition; search?: string }): {
	where: string;
	params: (string | number)[];
} {
	const conditions = ['user_id = ?', 'group_name = ?'];
	const params: (string | number)[] = [filter.userId, filter.groupName];
	if (filter.after) {
		conditions.push(AFTER_POSITION);
		params.push(...filter.after);
	}
	const matching = searchCondition(filter.search ?? '');
	if (matching) {
		conditions.push(matching.sql);
		params.push(...matching.params);
	}
	return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

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
 * Creates a contact for `userId`. Throws ContactValidationError if the input is invalid.
 * `id` and `createdAt` are only for restoring a deleted contact (undo).
 */
export function createContact(
	db: Database,
	userId: number,
	input: ContactInput,
	restore: { id?: number; createdAt?: string } = {}
): Contact {
	const { values, errors } = validateContact(input);
	if (Object.keys(errors).length > 0) throw new ContactValidationError(errors);

	const now = new Date().toISOString();
	const row = db
		.query<{ id: number }, (string | number | null)[]>(
			`INSERT INTO contacts (id, user_id, group_name, location, phone_number, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
		)
		.get(
			restore.id ?? null,
			userId,
			values.groupName,
			values.location,
			values.phoneNumber,
			values.description,
			restore.createdAt ?? now,
			now
		)!;
	return findContact(db, userId, row.id)!;
}

export function findContact(db: Database, userId: number, id: number): Contact | null {
	return db.query<Contact, [number, number]>(`${SELECT_CONTACT} WHERE id = ? AND user_id = ?`).get(id, userId);
}

/**
 * Updates a contact's fields, keeping its id and creation time. Returns the updated contact, or
 * null if it didn't exist. Throws ContactValidationError if the input is invalid.
 */
export function updateContact(db: Database, userId: number, id: number, input: ContactInput): Contact | null {
	const { values, errors } = validateContact(input);
	if (Object.keys(errors).length > 0) throw new ContactValidationError(errors);

	const now = new Date().toISOString();
	const updated = db
		.query<{ id: number }, (string | number)[]>(
			`UPDATE contacts SET group_name = ?, location = ?, phone_number = ?, description = ?, updated_at = ?
			 WHERE id = ? AND user_id = ? RETURNING id`
		)
		.get(values.groupName, values.location, values.phoneNumber, values.description, now, id, userId);
	return updated ? findContact(db, userId, updated.id) : null;
}

/** Deletes a contact. Returns it, or null if it didn't exist. */
export function deleteContact(db: Database, userId: number, id: number): Contact | null {
	return db.query<Contact, [number, number]>(
		`DELETE FROM contacts WHERE id = ? AND user_id = ?
		 RETURNING id, group_name AS groupName, location, phone_number AS phoneNumber, description,
		           created_at AS createdAt, updated_at AS updatedAt`
	).get(id, userId);
}

/**
 * Every group of `userId` with its number of contacts, in list order: [{ name: "Doctors", count: 2 }, …].
 * With a search, only groups with matching contacts, counting only those.
 * "family" and "Family" are one group (NOCASE); the name shown is the capitalized spelling if any.
 */
export function groupCounts(db: Database, userId: number, search = ''): GroupCount[] {
	const matching = searchCondition(search);
	// The search only decides what is counted (a condition is 1 or 0), not which rows are read: the name
	// comes from all contacts of a group, so a group isn't called "family" in one search and "Family" in another.
	return db
		.query<GroupCount, (string | number)[]>(
			`SELECT MIN(group_name COLLATE BINARY) AS name, ${matching ? `SUM(${matching.sql})` : 'COUNT(*)'} AS count
			 FROM contacts WHERE user_id = ? GROUP BY group_name HAVING count > 0 ORDER BY group_name`
		)
		.all(...(matching?.params ?? []), userId);
}

/** Number of contacts in `userId`'s phone book. */
export function countContacts(db: Database, userId: number): number {
	return db.query<{ n: number }, [number]>('SELECT COUNT(*) AS n FROM contacts WHERE user_id = ?').get(userId)!.n;
}

/** A contact's place in its group's list order, for continuing a section after it. */
export function listPosition(contact: Contact): ListPosition {
	return [contact.location, contact.phoneNumber, contact.id];
}

/**
 * One chunk of a group's contacts in list order, continuing after `after` (from the start if omitted),
 * optionally only those matching `search`.
 * Continuing "after X" rather than "skip N" means deleting a contact never shifts the next chunk
 * and hides someone. `remaining` counts the (matching) contacts after this chunk.
 */
export function sectionChunk(
	db: Database,
	userId: number,
	groupName: string,
	after?: ListPosition,
	limit = SECTION_CHUNK_SIZE,
	search = ''
): { contacts: Contact[]; more: boolean; remaining: number } {
	const { where, params } = listFilter({ userId, groupName, after, search });
	const rows = db
		.query<Contact, (string | number)[]>(`${SELECT_CONTACT} ${where} ${GROUP_ORDER} LIMIT ?`)
		.all(...params, limit + 1);
	const contacts = rows.slice(0, limit);
	const more = rows.length > limit;
	const remaining = more ? countInGroup(db, userId, groupName, listPosition(contacts.at(-1)!), search) : 0;
	return { contacts, more, remaining };
}

/** Contacts in a group, optionally only those after a list position and/or matching a search. */
export function countInGroup(db: Database, userId: number, groupName: string, after?: ListPosition, search = ''): number {
	const { where, params } = listFilter({ userId, groupName, after, search });
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
