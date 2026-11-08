<script lang="ts">
	// Light/dark toggle that follows the system theme until the user picks one.
	// - No saved choice: no data-theme on <html>, so daisyUI follows the OS (live).
	// - Toggling saves "light" or "dark" in localStorage and sets data-theme.
	// - Toggling back to whatever the OS uses clears the saved choice: the page follows the OS again.
	// The saved choice is applied before first paint by the inline script in src/app.html.
	import { onMount } from 'svelte';
	import { Theme, isTheme } from '#lib/theme.js';

	const STORAGE_KEY = 'theme';
	let current = $state<Theme>(Theme.Light);
	let mounted = $state(false);
	const label = $derived(!mounted ? 'Toggle dark mode' : current === Theme.Dark ? 'Switch to light mode' : 'Switch to dark mode');

	function systemTheme(): Theme {
		return matchMedia('(prefers-color-scheme: dark)').matches ? Theme.Dark : Theme.Light;
	}

	function sync() {
		const saved = document.documentElement.dataset.theme;
		current = isTheme(saved) ? saved : systemTheme();
	}

	function save(theme: Theme | null) {
		try {
			if (theme) localStorage.setItem(STORAGE_KEY, theme);
			else localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Storage blocked (private mode, etc.): the toggle still works for this page view.
		}
	}

	function toggle() {
		const next = current === Theme.Dark ? Theme.Light : Theme.Dark;
		if (next === systemTheme()) {
			save(null);
			delete document.documentElement.dataset.theme;
		} else {
			save(next);
			document.documentElement.dataset.theme = next;
		}
		sync();
	}

	onMount(() => {
		const media = matchMedia('(prefers-color-scheme: dark)');
		sync();
		mounted = true;
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	});
</script>

<button type="button" class="btn btn-ghost btn-circle" aria-label={label} title={label} onclick={toggle}>
	{#if mounted && current === Theme.Dark}
		<!-- Sun: shown in dark mode (the theme you'd switch to) -->
		<svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
			stroke-width="2" stroke-linecap="round" aria-hidden="true">
			<circle cx="12" cy="12" r="4"></circle>
			<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
		</svg>
	{:else if mounted}
		<!-- Moon: shown in light mode -->
		<svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
			stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
		</svg>
	{/if}
</button>
