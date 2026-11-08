import { beforeEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import {
	ContactValidationError,
	countInSection,
	createContact,
	decodeListPosition,
	deleteContact,
	encodeListPosition,
	findContact,
	letterCounts,
	listPosition,
	sectionChunk,
	validateContact
} from './contacts.js';
import { addContact, testDatabase } from './test-helpers.js';

let db: Database;
beforeEach(() => {
	db = testDatabase();
});

describe('validateContact', () => {
	const valid = { groupName: 'Friends', location: 'Basel', phoneNumber: '+41 79 123 45 67' };

	test('accepts group, location and phone number', () => {
		expect(validateContact(valid).errors).toEqual({});
	});

	test('requires all three fields', () => {
		expect(validateContact({ groupName: '', location: ' ', phoneNumber: '' }).errors).toEqual({
			groupName: ["can't be blank"],
			location: ["can't be blank"],
			phoneNumber: ["can't be blank"]
		});
	});

	test('accepts common phone number formats', () => {
		for (const phoneNumber of ['+41 79 123 45 67', '(555) 010-0199', '044/123.45.67', '112']) {
			expect(validateContact({ ...valid, phoneNumber }).errors).toEqual({});
		}
	});

	test('rejects letters and too few digits', () => {
		for (const phoneNumber of ['call me', '555-CALL', '+1', '--']) {
			expect(validateContact({ ...valid, phoneNumber }).errors.phoneNumber).toBeDefined();
		}
	});

	test('limits lengths', () => {
		const { errors } = validateContact({ ...valid, groupName: 'x'.repeat(101), phoneNumber: '1'.repeat(31) });
		expect(errors.groupName).toEqual(['is too long (maximum is 100 characters)']);
		expect(errors.phoneNumber).toEqual(['is too long (maximum is 30 characters)']);
	});

	test('trims and collapses whitespace', () => {
		const { values } = validateContact({ groupName: '  Work  ', location: ' New  York ', phoneNumber: ' 555   0101 ' });
		expect(values).toEqual({ groupName: 'Work', location: 'New York', phoneNumber: '555 0101' });
	});
});

describe('createContact', () => {
	test('stores the normalized contact with its side-index letter', () => {
		const contact = createContact(db, { groupName: ' Ärzte ', location: 'Bern', phoneNumber: '555 0150' });
		expect(contact).toMatchObject({ groupName: 'Ärzte', location: 'Bern', phoneNumber: '555 0150', indexLetter: 'A' });
		expect(findContact(db, contact.id)).toEqual(contact);
	});

	test('refuses invalid input', () => {
		expect(() => createContact(db, { groupName: '', location: 'Bern', phoneNumber: '555 0150' })).toThrow(
			ContactValidationError
		);
	});
});

test('deleteContact returns the deleted contact, or null', () => {
	const contact = addContact(db);
	expect(deleteContact(db, contact.id)).toEqual(contact);
	expect(findContact(db, contact.id)).toBeNull();
	expect(deleteContact(db, contact.id)).toBeNull();
});

test('letterCounts counts per letter in A–Z order with # last', () => {
	addContact(db, { groupName: '112 Emergency' });
	addContact(db, { groupName: 'Work' });
	addContact(db, { groupName: 'family' });
	addContact(db, { groupName: 'Family' });
	addContact(db, { groupName: 'Ärzte' });
	expect(letterCounts(db)).toEqual([
		['A', 1],
		['F', 2],
		['W', 1],
		['#', 1]
	]);
});

describe('sectionChunk', () => {
	test('sorts by group and location ignoring case', () => {
		const zurich = addContact(db, { groupName: 'Family', location: 'Zurich' });
		const lowercase = addContact(db, { groupName: 'family', location: 'Aarau' });
		const upperLocation = addContact(db, { groupName: 'Family', location: 'BERN' });
		expect(sectionChunk(db, 'F').contacts.map((c) => c.id)).toEqual([lowercase.id, upperLocation.id, zurich.id]);
	});

	test('pages through a letter in list order', () => {
		const family = Array.from({ length: 7 }, (_, i) => addContact(db, { groupName: 'Family', location: `City ${i}` }));

		const first = sectionChunk(db, 'F', undefined, 3);
		expect(first.contacts).toEqual(family.slice(0, 3));
		expect(first).toMatchObject({ more: true, remaining: 4 });

		const second = sectionChunk(db, 'F', listPosition(first.contacts.at(-1)!), 3);
		expect(second.contacts).toEqual(family.slice(3, 6));
		expect(second).toMatchObject({ more: true, remaining: 1 });

		const last = sectionChunk(db, 'F', listPosition(second.contacts.at(-1)!), 3);
		expect(last.contacts).toEqual([family[6]]);
		expect(last).toMatchObject({ more: false, remaining: 0 });
	});

	test('continues correctly when contacts were deleted meanwhile', () => {
		const family = Array.from({ length: 6 }, (_, i) => addContact(db, { groupName: 'Family', location: `City ${i}` }));
		const first = sectionChunk(db, 'F', undefined, 3);

		deleteContact(db, family[1].id); // a row that is already shown
		deleteContact(db, family[2].id); // the very row the next chunk continues after

		const second = sectionChunk(db, 'F', listPosition(first.contacts.at(-1)!), 3);
		expect(second.contacts).toEqual(family.slice(3, 6)); // nothing skipped or repeated
	});

	test('only returns the requested letter', () => {
		addContact(db, { groupName: 'Work' });
		const friend = addContact(db, { groupName: 'Friends' });
		expect(sectionChunk(db, 'F').contacts).toEqual([friend]);
		expect(countInSection(db, 'W')).toBe(1);
	});

	test('uses the list-order index instead of sorting the table', () => {
		const plan = db
			.query<{ detail: string }, []>(
				"EXPLAIN QUERY PLAN SELECT * FROM contacts WHERE index_letter = 'F' AND (group_name, location, phone_number, id) > ('a', 'b', 'c', 1) ORDER BY group_name, location, phone_number, id LIMIT 101"
			)
			.all()
			.map((row) => row.detail)
			.join(' | ');
		expect(plan).toContain('USING INDEX contacts_letter_section_order');
		expect(plan).not.toContain('TEMP B-TREE');
	});
});

test('list positions survive the round trip through a URL, and junk is rejected', () => {
	const position = listPosition(addContact(db, { groupName: 'Café "Zürich"' }));
	expect(decodeListPosition(encodeListPosition(position))).toEqual(position);
	for (const junk of ['not-a-position', '', Buffer.from('[1,2,3,4]').toString('base64url')]) {
		expect(decodeListPosition(junk)).toBeNull();
	}
});
