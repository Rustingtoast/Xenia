import { getDb } from '#lib/server/db.js';

// Health check: 200 if the app runs and the database answers (for monitoring / deploy scripts).
export const GET = () => {
	getDb().query('SELECT 1').get();
	return new Response('OK');
};
