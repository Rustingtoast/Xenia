import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { migrate } from './migrations.js';

test('migrations run once each, and a version-1 database gains the later ones', () => {
	const db = new Database(':memory:', { strict: true });
	expect(migrate(db)).toEqual([1, 2, 3, 4]);
	expect(migrate(db)).toEqual([]); // nothing left to do

	// Simulate a database created by migration 1 (before descriptions and accounts existed).
	const old = new Database(':memory:', { strict: true });
	old.run('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
	old.run(`CREATE TABLE contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, group_name TEXT NOT NULL COLLATE NOCASE,
		location TEXT NOT NULL COLLATE NOCASE, phone_number TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
	old.run('CREATE INDEX contacts_group_order ON contacts (group_name, location, phone_number)');
	old.run("INSERT INTO schema_migrations VALUES (1, 'create contacts', '2026-11-08')");
	old.run("INSERT INTO contacts (group_name, location, phone_number, created_at, updated_at) VALUES ('Work', 'Bern', '555 0101', 'x', 'x')");

	expect(migrate(old)).toEqual([2, 3, 4]);
	// The legacy contact gained an empty description and a NULL owner; the accounts tables exist.
	expect(old.query<{ description: string }, []>('SELECT description FROM contacts').get()!.description).toBe('');
	expect(old.query<{ n: number }, []>('SELECT COUNT(*) AS n FROM users').get()!.n).toBe(0);
});
