// Test helper, run with Bun by e2e/support.ts: replaces the shared test user's contacts with the
// JSON array read from stdin, and prints the created contacts as JSON. The test user and its
// session are created once by e2e/auth-setup.ts (Playwright's global setup).
import { createContact, type ContactInput } from '../src/lib/server/contacts.ts';
import { findUserByEmail } from '../src/lib/server/auth.ts';
import { openDatabase } from '../src/lib/server/db.ts';
import { TEST_USER_EMAIL } from './auth-constants.ts';

const db = openDatabase(process.env.DATABASE_PATH!);
const inputs: ContactInput[] = JSON.parse(await Bun.stdin.text());

const user = findUserByEmail(db, TEST_USER_EMAIL);
if (!user) {
	console.error(`Test user ${TEST_USER_EMAIL} not found; the Playwright global setup creates it.`);
	process.exit(1);
}

const created = db.transaction(() => {
	db.run('DELETE FROM contacts WHERE user_id = ?', [user.id]);
	return inputs.map((input) => createContact(db, user.id, input));
})();
console.log(JSON.stringify(created));
