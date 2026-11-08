import { error } from '@sveltejs/kit';
import { letterFromParam, type SectionChunkResponse } from '#lib/contacts.js';
import { decodeListPosition, encodeListPosition, listPosition, sectionChunk } from '#lib/server/contacts.js';
import { getDb } from '#lib/server/db.js';
import type { RequestHandler } from './$types';

// GET /contacts/letters/F            first chunk of F
// GET /contacts/letters/F?after=…    the chunk after a list position
// GET /contacts/letters/other        the "#" section
export const GET: RequestHandler = ({ params, url }) => {
	const letter = letterFromParam(params.letter);
	if (!letter) error(404, 'No such letter');

	const afterParam = url.searchParams.get('after');
	const after = afterParam ? decodeListPosition(afterParam) : undefined;
	if (after === null) error(400, 'Invalid list position');

	// Once users exist (issue #8) this must only return the signed-in user's contacts.
	const { contacts, more, remaining } = sectionChunk(getDb(), letter, after);
	const body: SectionChunkResponse = {
		contacts,
		next: more ? encodeListPosition(listPosition(contacts.at(-1)!)) : null,
		remaining
	};
	return Response.json(body, { headers: { 'cache-control': 'no-store' } });
};
