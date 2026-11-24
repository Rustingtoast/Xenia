// Run once by Playwright's global setup (via Bun): creates the shared test account and a session,
// and prints the session token so the setup can write it into the browser storage state. Every test
// then starts already signed in, without a login round-trip.
import { createSession, createUser, findUserByEmail } from '../src/lib/server/auth.ts';
import { openDatabase } from '../src/lib/server/db.ts';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './auth-constants.ts';

const db = openDatabase(process.env.DATABASE_PATH!);
const user = findUserByEmail(db, TEST_USER_EMAIL) ?? (await createUser(db, TEST_USER_EMAIL, TEST_USER_PASSWORD));
if (!user) {
	console.error('Could not create the test account.');
	process.exit(1);
}

// A fresh session per run; sessions from previous runs are stale but harmless.
const { token } = createSession(db, user.id);
console.log(JSON.stringify({ token, email: user.email }));
