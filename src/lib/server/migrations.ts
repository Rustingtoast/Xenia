import type { Database } from 'bun:sqlite';

// Database schema changes, applied in order and recorded in schema_migrations.
// Never edit a migration once it is on main: add a new one instead.
const MIGRATIONS: { version: number; name: string; sql: string }[] = [
	{
		version: 1,
		name: 'create contacts',
		// group_name and location are NOCASE, so "family" sorts and matches like "Family" (same group).
		// The index matches the list order exactly (SQLite indexes end with the row id, the final
		// tie-breaker), so loading a group in chunks never sorts the table, and group counts read it.
		sql: `
			CREATE TABLE contacts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				group_name TEXT NOT NULL COLLATE NOCASE,
				location TEXT NOT NULL COLLATE NOCASE,
				phone_number TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
			CREATE INDEX contacts_group_order ON contacts (group_name, location, phone_number);
		`
	},
	{
		version: 2,
		name: 'add contact description',
		// Optional free text; existing contacts get an empty description.
		sql: `ALTER TABLE contacts ADD COLUMN description TEXT NOT NULL DEFAULT ''`
	},
	{
		version: 3,
		name: 'add users and sessions',
		// Passwords are stored as argon2id hashes; sessions as the SHA-256 of an opaque token,
		// so a database leak exposes neither. email is NOCASE + unique: one account per address.
		sql: `
			CREATE TABLE users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				email TEXT NOT NULL COLLATE NOCASE UNIQUE,
				password_hash TEXT NOT NULL,
				created_at TEXT NOT NULL
			);
			CREATE TABLE sessions (
				token_hash TEXT PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				created_at TEXT NOT NULL,
				expires_at TEXT NOT NULL
			);
			CREATE INDEX sessions_user_id ON sessions (user_id);
		`
	},
	{
		version: 4,
		name: 'add contact owner',
		// Each contact belongs to one user. Legacy sample rows get a NULL owner (and are never shown);
		// the seed re-creates them for the demo user. user_id leads the list index, so every list
		// query for one user reads a contiguous slice.
		sql: `
			ALTER TABLE contacts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
			DROP INDEX contacts_group_order;
			CREATE INDEX contacts_group_order ON contacts (user_id, group_name, location, phone_number);
		`
	}
];

/** Applies all migrations that haven't run yet. Safe to call on every start. */
export function migrate(db: Database): number[] {
	db.run(
		'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'
	);
	const applied = new Set(
		db.query<{ version: number }, []>('SELECT version FROM schema_migrations').all().map((row) => row.version)
	);
	const ran: number[] = [];
	for (const migration of MIGRATIONS) {
		if (applied.has(migration.version)) continue;
		db.transaction(() => {
			db.run(migration.sql);
			db.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
				migration.version,
				migration.name,
				new Date().toISOString()
			]);
		})();
		ran.push(migration.version);
	}
	return ran;
}
