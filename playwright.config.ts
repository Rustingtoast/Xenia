import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the production build (the same Bun server that gets deployed),
// in headless Firefox, with their own database file.
const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
export const E2E_DATABASE_PATH = 'storage/xenia-e2e.sqlite3';

export default defineConfig({
	testDir: 'e2e',
	// All tests share one server and database, so run them one after another.
	workers: 1,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: ORIGIN,
		// Report a light system theme on every machine (a Mac in dark mode would otherwise leak into tests).
		colorScheme: 'light',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 1400 } } }],
	webServer: {
		command: 'bun run build && bun ./build',
		url: `${ORIGIN}/up`,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			XENIA_ORIGIN: ORIGIN, // build time: plain-http origin, so form posts pass the CSRF check
			HOST: '127.0.0.1',
			PORT: String(PORT),
			DATABASE_PATH: E2E_DATABASE_PATH,
			XENIA_SECRET: 'e2e-secret-not-for-production'
		}
	}
});
