import type { Handle } from '@sveltejs/kit/hooks';
import { getDb } from '#lib/server/db.js';
import { appSecret } from '#lib/server/secret.js';
import { SESSION_COOKIE, sessionUser } from '#lib/server/auth.js';

// Runs once when the server starts: open + migrate the database, and fail fast
// (instead of on the first delete) if production has no XENIA_SECRET.
export const init = async () => {
	getDb();
	appSecret();
};

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? sessionUser(getDb(), token) : null;
	return resolve(event);
};
