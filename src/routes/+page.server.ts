import { fail } from '@sveltejs/kit';
import { ActionOutcome, normalizeSearch, type ContactChange } from '#lib/contacts.js';
import {
	countContacts,
	createContact,
	deleteContact,
	findContact,
	groupCounts,
	updateContact,
	validateContact,
	type ContactInput
} from '#lib/server/contacts.js';
import { getDb } from '#lib/server/db.js';
import { appSecret } from '#lib/server/secret.js';
import { createUndoToken, restoreFromUndoToken } from '#lib/server/undo.js';
import type { Actions, PageServerLoad } from './$types';

// The list page loads only the groups and their counts; each group's contacts are fetched lazily in chunks
// by its section (see routes/contacts/group/+server.ts).
// ?q=… searches group, location, phone number and description; only matching groups are returned, counting
// the matches.
export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const search = normalizeSearch(url.searchParams.get('q') ?? '');
	const groups = groupCounts(db, search);
	return {
		groups,
		search,
		/** Contacts in the whole phone book. */
		total: countContacts(db),
		/** Contacts shown: all, or those matching the search. */
		matches: groups.reduce((sum, group) => sum + group.count, 0)
	};
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		// Once accounts exist, this must only delete the signed-in user's contacts.
		const contact = Number.isInteger(id) ? deleteContact(getDb(), id) : null;
		if (!contact) return fail(404, { outcome: ActionOutcome.NotFound as const });

		return {
			outcome: ActionOutcome.Deleted as const,
			deleted: { id: contact.id, groupName: contact.groupName },
			undoToken: await createUndoToken(contact, appSecret())
		};
	},

	// The "Undo" button in the banner after a delete.
	restore: async ({ request }) => {
		const token = String((await request.formData()).get('token') ?? '');
		const contact = await restoreFromUndoToken(getDb(), token, appSecret());
		if (!contact) return fail(410, { outcome: ActionOutcome.RestoreFailed as const });

		return { outcome: ActionOutcome.Restored as const, restored: { id: contact.id, groupName: contact.groupName } };
	},

	// The "New contact" dialog. Creates a contact and tells the page where it landed.
	create: async ({ request }) => {
		const data = await request.formData();
		const input: ContactInput = {
			groupName: String(data.get('groupName') ?? ''),
			location: String(data.get('location') ?? ''),
			phoneNumber: String(data.get('phoneNumber') ?? ''),
			description: String(data.get('description') ?? '')
		};
		const { values, errors } = validateContact(input);
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		const contact = createContact(getDb(), values);
		return {
			outcome: ActionOutcome.Created as const,
			change: { id: contact.id, groupName: contact.groupName } satisfies ContactChange
		};
	},

	// The "Edit contact" dialog. Saves the new fields; the page moves the row if its group changed.
	update: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id)) return fail(404, { outcome: ActionOutcome.NotFound as const });

		const input: ContactInput = {
			groupName: String(data.get('groupName') ?? ''),
			location: String(data.get('location') ?? ''),
			phoneNumber: String(data.get('phoneNumber') ?? ''),
			description: String(data.get('description') ?? '')
		};
		const { values, errors } = validateContact(input);
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		const previous = findContact(getDb(), id);
		if (!previous) return fail(404, { outcome: ActionOutcome.NotFound as const });

		const contact = updateContact(getDb(), id, values)!;
		return {
			outcome: ActionOutcome.Updated as const,
			change: {
				id: contact.id,
				groupName: contact.groupName,
				previousGroupName: previous.groupName
			} satisfies ContactChange
		};
	}
};
