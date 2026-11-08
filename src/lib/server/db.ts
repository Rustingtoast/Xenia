import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrate } from './migrations.js';

/** The dev database. Not development.sqlite3: that name belongs to the Rails version on older branches. */
export const DEVELOPMENT_DATABASE_PATH = 'storage/xenia-development.sqlite3';

/** Where the database lives. Override with DATABASE_PATH (the e2e tests and deployments do). */
export function databasePath(): string {
	return process.env.DATABASE_PATH || DEVELOPMENT_DATABASE_PATH;
}

/** Opens (creating if needed) and migrates a database. ":memory:" works for tests. */
export function openDatabase(path: string): Database {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path, { create: true, strict: true });
	db.run('PRAGMA journal_mode = WAL');
	db.run('PRAGMA busy_timeout = 5000');
	db.run('PRAGMA foreign_keys = ON');
	migrate(db);
	return db;
}

let shared: Database | undefined;

/** The app's database connection, opened on first use. */
export function getDb(): Database {
	shared ??= openDatabase(databasePath());
	return shared;
}
