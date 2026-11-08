import type { Database } from 'bun:sqlite';

// Database schema changes, applied in order and recorded in schema_migrations.
// Never edit a migration once it is on main: add a new one instead.
const MIGRATIONS: { version: number; name: string; sql: string }[] = [
	{
		version: 1,
		name: 'create contacts',
		// group_name and location are NOCASE, so "family" sorts and matches like "Family".
		// index_letter is the side-index letter (A–Z or "#"), set by the app on every save.
		// The index matches the list order exactly (SQLite indexes end with the row id, the final
		// tie-breaker), so loading a letter in chunks never sorts the table.
		sql: `
			CREATE TABLE contacts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				group_name TEXT NOT NULL COLLATE NOCASE,
				location TEXT NOT NULL COLLATE NOCASE,
				phone_number TEXT NOT NULL,
				index_letter TEXT NOT NULL DEFAULT '#',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
			CREATE INDEX contacts_letter_section_order
				ON contacts (index_letter, group_name, location, phone_number);
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
