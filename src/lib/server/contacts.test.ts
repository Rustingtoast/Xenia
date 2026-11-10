import { beforeEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import {
	ContactValidationError,
	countContacts,
	countInGroup,
	createContact,
	decodeListPosition,
	deleteContact,
	encodeListPosition,
	findContact,
	groupCounts,
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
		expect(values).toEqual({ groupName: 'Work', location: 'New York', phoneNumber: '555 0101', description: '' });
	});

	test('description is optional, only trimmed (line breaks kept) and limited to 1000 characters', () => {
		expect(validateContact(valid).errors).toEqual({});
		const { values } = validateContact({ ...valid, description: '  Call after 6 pm.\n  Gate code 1234  ' });
		expect(values.description).toBe('Call after 6 pm.\n  Gate code 1234');
		expect(validateContact({ ...valid, description: 'x'.repeat(1001) }).errors.description).toEqual([
			'is too long (maximum is 1000 characters)'
		]);
	});
});

describe('createContact', () => {
	test('stores the normalized contact', () => {
		const contact = createContact(db, { groupName: ' Ärzte ', location: 'Bern', phoneNumber: '555 0150' });
		expect(contact).toMatchObject({ groupName: 'Ärzte', location: 'Bern', phoneNumber: '555 0150', description: '' });
		expect(findContact(db, contact.id)).toEqual(contact);
	});

	test('stores the description', () => {
		const contact = createContact(db, { groupName: 'Work', location: 'Bern', phoneNumber: '555 0150', description: 'Reception\nAsk for Anna' });
		expect(findContact(db, contact.id)!.description).toBe('Reception\nAsk for Anna');
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

test('groupCounts lists every group with its count in order, "family" and "Family" being one group', () => {
	addContact(db, { groupName: 'Work' });
	addContact(db, { groupName: 'family' });
	addContact(db, { groupName: 'Family' });
	addContact(db, { groupName: 'Ärzte' });
	addContact(db, { groupName: '112 Emergency' });
	expect(groupCounts(db)).toEqual([
		{ name: '112 Emergency', count: 1 },
		{ name: 'Family', count: 2 }, // the capitalized spelling is shown
		{ name: 'Work', count: 1 },
		{ name: 'Ärzte', count: 1 } // SQLite sorts non-ASCII letters after Z
	]);
});

describe('sectionChunk', () => {
	test('returns one group, sorted by location ignoring case, matching the group name ignoring case', () => {
		const zurich = addContact(db, { groupName: 'Family', location: 'Zurich' });
		const aarau = addContact(db, { groupName: 'family', location: 'Aarau' });
		const bern = addContact(db, { groupName: 'Family', location: 'BERN' });
		addContact(db, { groupName: 'Friends', location: 'Basel' });
		expect(sectionChunk(db, 'FAMILY').contacts.map((c) => c.id)).toEqual([aarau.id, bern.id, zurich.id]);
		expect(countInGroup(db, 'family')).toBe(3);
	});

	test('pages through a group in list order', () => {
		const family = Array.from({ length: 7 }, (_, i) => addContact(db, { groupName: 'Family', location: `City ${i}` }));

		const first = sectionChunk(db, 'Family', undefined, 3);
		expect(first.contacts).toEqual(family.slice(0, 3));
		expect(first).toMatchObject({ more: true, remaining: 4 });

		const second = sectionChunk(db, 'Family', listPosition(first.contacts.at(-1)!), 3);
		expect(second.contacts).toEqual(family.slice(3, 6));
		expect(second).toMatchObject({ more: true, remaining: 1 });

		const last = sectionChunk(db, 'Family', listPosition(second.contacts.at(-1)!), 3);
		expect(last.contacts).toEqual([family[6]]);
		expect(last).toMatchObject({ more: false, remaining: 0 });
	});

	test('continues correctly when contacts were deleted meanwhile', () => {
		const family = Array.from({ length: 6 }, (_, i) => addContact(db, { groupName: 'Family', location: `City ${i}` }));
		const first = sectionChunk(db, 'Family', undefined, 3);

		deleteContact(db, family[1].id); // a row that is already shown
		deleteContact(db, family[2].id); // the very row the next chunk continues after

		const second = sectionChunk(db, 'Family', listPosition(first.contacts.at(-1)!), 3);
		expect(second.contacts).toEqual(family.slice(3, 6)); // nothing skipped or repeated
	});

	test('uses the group-order index instead of sorting the table', () => {
		const plan = db
			.query<{ detail: string }, []>(
				"EXPLAIN QUERY PLAN SELECT * FROM contacts WHERE group_name = 'Family' AND (location, phone_number, id) > ('b', 'c', 1) ORDER BY location, phone_number, id LIMIT 101"
			)
			.all()
			.map((row) => row.detail)
			.join(' | ');
		expect(plan).toContain('USING INDEX contacts_group_order');
		expect(plan).not.toContain('TEMP B-TREE');
	});
});

test('list positions survive the round trip through a URL, and junk is rejected', () => {
	const position = listPosition(addContact(db, { groupName: 'Café "Zürich"' }));
	expect(decodeListPosition(encodeListPosition(position))).toEqual(position);
	for (const junk of ['not-a-position', '', Buffer.from('[1,2,3]').toString('base64url')]) {
		expect(decodeListPosition(junk)).toBeNull();
	}
});

describe('search (issue #7)', () => {
	beforeEach(() => {
		addContact(db, { groupName: 'Family', location: 'Zurich' });
		addContact(db, { groupName: 'Family', location: 'Bern' });
		addContact(db, { groupName: 'Friends', location: 'Zurich West' });
		addContact(db, { groupName: 'Work', location: 'Basel' });
		addContact(db, { groupName: 'Bernese Club', location: 'Thun' });
	});

	test('matches the group or the location, ignoring case, and counts only matches', () => {
		expect(groupCounts(db, 'zurich')).toEqual([
			{ name: 'Family', count: 1 },
			{ name: 'Friends', count: 1 }
		]);
		expect(groupCounts(db, 'BERN')).toEqual([
			{ name: 'Bernese Club', count: 1 }, // group matches
			{ name: 'Family', count: 1 } // location matches
		]);
		expect(groupCounts(db, 'fam')).toEqual([{ name: 'Family', count: 2 }]); // whole group
	});

	test('no search means everything; spaces around the search are ignored', () => {
		expect(groupCounts(db, '').reduce((sum, group) => sum + group.count, 0)).toBe(5);
		expect(groupCounts(db, '  zurich ')).toEqual(groupCounts(db, 'zurich'));
		expect(countContacts(db)).toBe(5);
	});

	test('% and _ are searched literally, not as wildcards', () => {
		addContact(db, { groupName: '100% Club', location: 'Olten' });
		addContact(db, { groupName: 'A_B', location: 'Aarau' });
		expect(groupCounts(db, '%').map((group) => group.name)).toEqual(['100% Club']);
		expect(groupCounts(db, '_').map((group) => group.name)).toEqual(['A_B']);
		expect(groupCounts(db, '\\')).toEqual([]);
	});

	test('a group keeps its name whatever the search finds in it', () => {
		addContact(db, { groupName: 'family', location: 'Thun' }); // the group is shown as "Family"
		expect(groupCounts(db).map((group) => group.name)).toContain('Family');
		expect(groupCounts(db, 'thun')).toEqual([
			{ name: 'Bernese Club', count: 1 },
			{ name: 'Family', count: 1 } // not "family", although only that contact matches
		]);
	});

	test('chunks of a group contain only matches, and remaining counts only matches', () => {
		for (let i = 0; i < 5; i++) addContact(db, { groupName: 'Family', location: `Zurich ${i}` });
		const first = sectionChunk(db, 'Family', undefined, 2, 'zurich');
		expect(first.contacts.every((contact) => contact.location.startsWith('Zurich'))).toBe(true);
		expect(first).toMatchObject({ more: true, remaining: 4 }); // 6 Zurich contacts in Family, 2 shown
		expect(countInGroup(db, 'Family', undefined, 'zurich')).toBe(6);
		expect(countInGroup(db, 'Family')).toBe(7);
	});
});

describe('search in phone numbers and descriptions', () => {
	test('finds the description', () => {
		addContact(db, { groupName: 'Doctors', location: 'Zurich', phoneNumber: '555-0115', description: 'Dr. Weber, family doctor' });
		addContact(db, { groupName: 'Work', location: 'Bern', phoneNumber: '555-0113' });
		expect(groupCounts(db, 'weber')).toEqual([{ name: 'Doctors', count: 1 }]);
	});

	test('finds phone numbers however they are written', () => {
		addContact(db, { groupName: 'Family', location: 'Zurich', phoneNumber: '+1 555-0101' });
		addContact(db, { groupName: 'Work', location: 'Bern', phoneNumber: '(555) 010-0113' });
		addContact(db, { groupName: 'Friends', location: 'Basel', phoneNumber: '555.0107' });
		const groupsFor = (search: string) => groupCounts(db, search).map((group) => group.name);

		expect(groupsFor('555-0101')).toEqual(['Family']); // as typed
		expect(groupsFor('5550101')).toEqual(['Family']); // without separators
		expect(groupsFor('555 0101')).toEqual(['Family']); // other separators
		expect(groupsFor('0100113')).toEqual(['Work']); // across "(555) 010-0113"
		expect(groupsFor('0107')).toEqual(['Friends']);
		expect(groupsFor('555')).toEqual(['Family', 'Friends', 'Work']);
	});

	test('finds a description across its line breaks, tabs and repeated spaces', () => {
		addContact(db, { groupName: 'Doctors', location: 'Zurich', description: 'Dr.  Weber, family doctor.\r\n\tOpen Mon–Fri.' });
		addContact(db, { groupName: 'Work', location: 'Bern', description: 'doctor.open' });
		const groupsFor = (search: string) => groupCounts(db, search).map((group) => group.name);

		expect(groupsFor('doctor. open')).toEqual(['Doctors']); // as the list shows it, on one line
		expect(groupsFor('dr. weber')).toEqual(['Doctors']);
		expect(groupsFor('doctor.  open')).toEqual(['Doctors']); // the search's own spaces are collapsed too
		expect(groupsFor('doctor.open')).toEqual(['Work']); // a missing space is not a match
		expect(sectionChunk(db, 'Doctors', undefined, undefined, 'doctor. open').contacts).toHaveLength(1);
	});

	test('short number-like searches match as typed only', () => {
		addContact(db, { groupName: 'Family', location: 'Zurich', phoneNumber: '+1 555-0101' });
		addContact(db, { groupName: 'Friends', location: 'Basel', phoneNumber: '555 0141', description: '1.5 km after the bridge' });
		addContact(db, { groupName: 'Work', location: 'Bern', phoneNumber: '+41 79 123 45 67' });
		const groupsFor = (search: string) => groupCounts(db, search).map((group) => group.name);

		expect(groupsFor('1.5')).toEqual(['Friends']); // the description, not "+1 555-0101"
		expect(groupsFor('+41')).toEqual(['Work']); // not "555 0141"
		expect(groupsFor('+4179')).toEqual(['Work']);
		expect(groupsFor('4179')).toEqual(['Work']); // without the "+": still part of that number
	});

	test('a "+" in the search only finds numbers that start with it', () => {
		addContact(db, { groupName: 'Work', location: 'Bern', phoneNumber: '+41 79 123 45 67' });
		addContact(db, { groupName: 'Friends', location: 'Basel', phoneNumber: '555 4179' });
		const groupsFor = (search: string) => groupCounts(db, search).map((group) => group.name);

		expect(groupsFor('+4179')).toEqual(['Work']);
		expect(groupsFor('4179')).toEqual(['Friends', 'Work']);
	});

	test('a word with a digit is not treated as a phone number', () => {
		addContact(db, { groupName: 'Family', location: 'Zurich', phoneNumber: '+1 555-0101' });
		addContact(db, { groupName: 'Office', location: 'Floor 1', phoneNumber: '555-0200' });
		// "floor 1" contains letters, so its "1" doesn't match every number containing a 1.
		expect(groupCounts(db, 'floor 1').map((group) => group.name)).toEqual(['Office']);
	});
});
