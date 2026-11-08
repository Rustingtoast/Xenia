// Database commands: bun scripts/db.ts migrate | seed | reset   (see package.json "db:*" scripts)
//
// migrate  create the database if needed and apply new migrations (safe to rerun)
// seed     add the sample contacts to the dev database (skips ones that already exist)
// reset    DELETE the dev database file, recreate it and seed it
//
// seed and reset only ever touch the default dev database, never one chosen with DATABASE_PATH
// (that is how production and the e2e tests point at their own files).
import { existsSync, rmSync } from 'node:fs';
import { createContact } from '../src/lib/server/contacts.ts';
import { DEVELOPMENT_DATABASE_PATH, databasePath, openDatabase } from '../src/lib/server/db.ts';

// Fictional sample contacts for local development and manual testing.
// Phone numbers use the 555-01xx range, which is reserved for fiction, and mix
// formats on purpose so search (issue #7) and display can be tried against them.
// [group, location, phone, description?] – some descriptions are long or multi-line on purpose,
// to try the cropping and the "full description" dialog; some contacts have none.
const SAMPLE_CONTACTS: [string, string, string, string?][] = [
	['Family', 'Zurich', '+1 555-0101', 'Mum'],
	['Family', 'Zurich', '+1 555-0102', 'Dad, mobile. Prefers text messages during the day.'],
	['Family', 'Geneva', '(555) 010-0103', 'Aunt Claire'],
	['Family', 'Bern', '555 0104'],
	['Friends', 'Zurich', '+1 555 0105', 'Marco – climbing on Thursdays'],
	['Friends', 'Basel', '555-0106'],
	['Friends', 'Basel', '555.0107', 'Lena'],
	['Friends', 'Lausanne', '+1 (555) 010-0108'],
	['Friends', 'Geneva', '555/0109', 'Sam (old number, check before calling)'],
	['Work', 'Zurich', '+1 555-0110', 'Reception, main building.\nAsk for the facility manager if the door code changed.'],
	['Work', 'Zurich', '+1 555-0111', 'IT helpdesk'],
	['Work', 'Zurich', '+1 555-0112'],
	['Work', 'Bern', '555 0113', 'Branch office Bern'],
	['Work', 'Remote', '+1 555 0114', 'On-call phone. Only for outages outside office hours; during the day use the helpdesk instead.'],
	['Doctors', 'Zurich', '555-0115', 'Dr. Weber, family doctor.\nOpening hours: Mon–Fri 8–12 and 14–18.\nEmergencies outside these hours: call the emergency practice.'],
	['Doctors', 'Bern', '(555) 010-0116', 'Dentist'],
	['Emergency', 'Zurich', '+1 555-0117', 'Emergency practice (nights and weekends)'],
	['Emergency', 'Basel', '+1 555-0118'],
	['Neighbours', 'Zurich', '555 0119', 'Mrs. Keller, 2nd floor – has a spare key'],
	['Neighbours', 'Zurich', '555-0120'],
	['Services', 'Lausanne', '+1 555 0121', 'Plumber'],
	['Services', 'Geneva', '555.0122', 'Electrician'],
	['Services', 'Remote', '+1 (555) 010-0123', 'Internet provider support. Customer number is on the contract in the blue folder.'],
	['School', 'Bern', '555 0124', 'School office'],
	['School', 'Bern', '555-0125']
];

const path = databasePath();
const command = process.argv[2];

function onlyOnDevelopmentDatabase(what: string) {
	if (path !== DEVELOPMENT_DATABASE_PATH) {
		console.error(`Refusing to ${what} in ${path}: only the dev database (${DEVELOPMENT_DATABASE_PATH}) is allowed.`);
		process.exit(1);
	}
}

function seed() {
	onlyOnDevelopmentDatabase('load sample contacts');
	const db = openDatabase(path);
	const existing = db.query<{ id: number; description: string }, [string, string, string]>(
		'SELECT id, description FROM contacts WHERE group_name = ? AND location = ? AND phone_number = ?'
	);
	let added = 0;
	for (const [groupName, location, phoneNumber, description = ''] of SAMPLE_CONTACTS) {
		const found = existing.get(groupName, location, phoneNumber);
		if (!found) {
			createContact(db, { groupName, location, phoneNumber, description });
			added++;
		} else if (!found.description && description) {
			// Sample contacts from before descriptions existed get theirs.
			db.run('UPDATE contacts SET description = ? WHERE id = ?', [description, found.id]);
		}
	}
	const total = db.query<{ n: number }, []>('SELECT COUNT(*) AS n FROM contacts').get()!.n;
	console.log(`Seeded sample contacts: ${added} new, ${total} total (${path}).`);
}

switch (command) {
	case 'migrate': {
		const created = !existsSync(path);
		const db = openDatabase(path); // opening runs migrations; this reports on them
		const versions = db.query<{ version: number }, []>('SELECT version FROM schema_migrations').all();
		console.log(`${created ? 'Created' : 'Migrated'} ${path} (schema version ${versions.at(-1)?.version ?? 0}).`);
		break;
	}
	case 'seed':
		seed();
		break;
	case 'reset':
		onlyOnDevelopmentDatabase('delete the database');
		for (const file of [path, `${path}-wal`, `${path}-shm`]) rmSync(file, { force: true });
		console.log(`Deleted ${path}.`);
		seed();
		break;
	default:
		console.error('Usage: bun scripts/db.ts migrate | seed | reset');
		process.exit(1);
}
