// Playwright global setup: creates the shared test account + session in the e2e database and writes
// the session cookie into a storage state, so every test starts signed in.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { E2E_DATABASE_PATH } from '../playwright.config.ts';

const STORAGE_STATE = 'test-results/storage-state.json';

export default function globalSetup() {
	const output = execFileSync('bun', ['e2e/auth-setup.ts'], {
		env: { ...process.env, DATABASE_PATH: E2E_DATABASE_PATH },
		encoding: 'utf8'
	});
	const { token } = JSON.parse(output);

	const storageState = {
		cookies: [
			{
				name: 'session',
				value: token,
				domain: '127.0.0.1',
				path: '/',
				httpOnly: true,
				secure: false,
				sameSite: 'Lax'
			}
		],
		origins: []
	};

	mkdirSync('test-results', { recursive: true });
	writeFileSync(STORAGE_STATE, JSON.stringify(storageState));
}
