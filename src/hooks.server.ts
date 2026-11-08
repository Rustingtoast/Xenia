import { getDb } from '#lib/server/db.js';
import { appSecret } from '#lib/server/secret.js';

// Runs once when the server starts: open + migrate the database, and fail fast
// (instead of on the first delete) if production has no XENIA_SECRET.
export const init = async () => {
	getDb();
	appSecret();
};
