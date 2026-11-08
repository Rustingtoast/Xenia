import { fail } from '@sveltejs/kit';
import { ActionOutcome } from '#lib/contacts.js';
import { deleteContact, letterCounts } from '#lib/server/contacts.js';
import { getDb } from '#lib/server/db.js';
import { appSecret } from '#lib/server/secret.js';
import { createUndoToken, restoreFromUndoToken } from '#lib/server/undo.js';
import type { Actions, PageServerLoad } from './$types';

// The list page loads only the letter counts; each letter's contacts are fetched lazily,
// in chunks, by its section (see routes/contacts/letters/[letter]/+server.ts).
export const load: PageServerLoad = () => {
	const counts = letterCounts(getDb());
	return { letterCounts: counts, total: counts.reduce((sum, [, count]) => sum + count, 0) };
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		// Once users exist (issue #8) this must only delete the signed-in user's contacts.
		const contact = Number.isInteger(id) ? deleteContact(getDb(), id) : null;
		if (!contact) return fail(404, { outcome: ActionOutcome.NotFound as const });

		return {
			outcome: ActionOutcome.Deleted as const,
			deleted: { id: contact.id, letter: contact.indexLetter },
			undoToken: await createUndoToken(contact, appSecret())
		};
	},

	// The "Undo" button in the banner after a delete.
	restore: async ({ request }) => {
		const token = String((await request.formData()).get('token') ?? '');
		const contact = await restoreFromUndoToken(getDb(), token, appSecret());
		if (!contact) return fail(410, { outcome: ActionOutcome.RestoreFailed as const });

		return { outcome: ActionOutcome.Restored as const, restored: { id: contact.id, letter: contact.indexLetter } };
	}
};
