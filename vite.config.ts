import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Builds a standalone Bun server into build/ (run with `bun ./build`).
			adapter: adapter({ out: 'build' }),
			paths: {
				// The public URL the app is reached at, e.g. http://192.168.2.20:3000. Needed for plain-HTTP
				// deployments: without it SvelteKit assumes https and rejects form posts as cross-site (CSRF).
				// Set at build time: XENIA_ORIGIN=http://… bun run build
				origin: process.env.XENIA_ORIGIN
			}
		})
	],
	build: {
		rollupOptions: {
			// Bun's built-in modules (bun:sqlite) are provided by the runtime, never bundled.
			external: [/^bun:/]
		}
	}
});
