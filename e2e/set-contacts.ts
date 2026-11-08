// Test helper, run with Bun by e2e/support.ts: replaces all contacts in the e2e database with the
// JSON array read from stdin, and prints the created contacts as JSON.
import { createContact, type ContactInput } from '../src/lib/server/contacts.ts';
import { openDatabase } from '../src/lib/server/db.ts';

const db = openDatabase(process.env.DATABASE_PATH!);
const inputs: ContactInput[] = JSON.parse(await Bun.stdin.text());
const created = db.transaction(() => {
	db.run('DELETE FROM contacts');
	return inputs.map((input) => createContact(db, input));
})();
console.log(JSON.stringify(created));
