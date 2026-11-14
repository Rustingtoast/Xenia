import { error } from '@sveltejs/kit';
import type { SectionChunkResponse } from '#lib/contacts.js';
import { decodeListPosition, encodeListPosition, listPosition, sectionChunk } from '#lib/server/contacts.js';
import { getDb } from '#lib/server/db.js';
import type { RequestHandler } from './$types';

// GET /contacts/group?name=Family             first chunk of the group
// GET /contacts/group?name=Family&after=…     the chunk after a list position
// GET /contacts/group?name=Family&q=bern      only contacts matching "bern"
// (name is a query parameter, not a path segment: group names may contain "/".)
export const GET: RequestHandler = ({ url, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	const groupName = url.searchParams.get('name');
	if (!groupName) error(400, 'Missing group name');

	const afterParam = url.searchParams.get('after');
	const after = afterParam ? decodeListPosition(afterParam) : undefined;
	if (after === null) error(400, 'Invalid list position');

	const search = url.searchParams.get('q') ?? '';
	const { contacts, more, remaining } = sectionChunk(getDb(), locals.user.id, groupName, after, undefined, search);
	const body: SectionChunkResponse = {
		contacts,
		next: more ? encodeListPosition(listPosition(contacts.at(-1)!)) : null,
		remaining
	};
	return Response.json(body, { headers: { 'cache-control': 'no-store' } });
};
