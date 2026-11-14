import { fail, redirect } from '@sveltejs/kit';
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
import { clearSessionCookie, deleteSession, SESSION_COOKIE } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { appSecret } from '#lib/server/secret.js';
import { createUndoToken, restoreFromUndoToken } from '#lib/server/undo.js';
import type { Actions, PageServerLoad } from './$types';

// The list page loads only the groups and their counts; each group's contacts are fetched lazily in chunks
// by its section (see routes/contacts/group/+server.ts). Everything is scoped to the signed-in user.
// ?q=… searches group, location, phone number and description; only matching groups are returned, counting
// the matches.
export const load: PageServerLoad = ({ url, locals }) => {
	if (!locals.user) redirect(307, '/login');
	const db = getDb();
	const userId = locals.user.id;
	const search = normalizeSearch(url.searchParams.get('q') ?? '');
	const groups = groupCounts(db, userId, search);
	return {
		groups,
		search,
		/** Contacts in the whole phone book. */
		total: countContacts(db, userId),
		/** Contacts shown: all, or those matching the search. */
		matches: groups.reduce((sum, group) => sum + group.count, 0)
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
		const id = Number((await request.formData()).get('id'));
		const contact = Number.isInteger(id) ? deleteContact(getDb(), locals.user.id, id) : null;
		if (!contact) return fail(404, { outcome: ActionOutcome.NotFound as const });

		return {
			outcome: ActionOutcome.Deleted as const,
			deleted: { id: contact.id, groupName: contact.groupName },
			undoToken: await createUndoToken(contact, locals.user.id, appSecret())
		};
	},

	// The "Undo" button in the banner after a delete.
	restore: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
		const token = String((await request.formData()).get('token') ?? '');
		const contact = await restoreFromUndoToken(getDb(), token, appSecret(), locals.user.id);
		if (!contact) return fail(410, { outcome: ActionOutcome.RestoreFailed as const });

		return { outcome: ActionOutcome.Restored as const, restored: { id: contact.id, groupName: contact.groupName } };
	},

	// The "New contact" dialog. Creates a contact and tells the page where it landed.
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
		const data = await request.formData();
		const input: ContactInput = {
			groupName: String(data.get('groupName') ?? ''),
			location: String(data.get('location') ?? ''),
			phoneNumber: String(data.get('phoneNumber') ?? ''),
			description: String(data.get('description') ?? '')
		};
		const { values, errors } = validateContact(input);
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		const contact = createContact(getDb(), locals.user.id, values);
		return {
			outcome: ActionOutcome.Created as const,
			change: { id: contact.id, groupName: contact.groupName } satisfies ContactChange
		};
	},

	// The "Edit contact" dialog. Saves the new fields; the page moves the row if its group changed.
	update: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
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

		const previous = findContact(getDb(), locals.user.id, id);
		if (!previous) return fail(404, { outcome: ActionOutcome.NotFound as const });

		const contact = updateContact(getDb(), locals.user.id, id, values)!;
		return {
			outcome: ActionOutcome.Updated as const,
			change: {
				id: contact.id,
				groupName: contact.groupName,
				previousGroupName: previous.groupName
			} satisfies ContactChange
		};
	},

	// The "Log out" button in the header: forget the session and show the login page.
	logout: async ({ locals, cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) deleteSession(getDb(), token);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};
