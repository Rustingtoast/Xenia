<script lang="ts">
	// The language menu (Settings and the login/register pages). Picking a language saves it in a cookie, so
	// the server renders every page in it, and reloads the messages: the page switches in place.
	// Give it a <label for={id}>.
	import type { ClassValue } from 'svelte/elements';
	import { invalidate } from '$app/navigation';
	import { saveLocale } from '#lib/i18n/cookie.js';
	import { LOCALE_DEPENDENCY, LOCALE_NAMES, Locale, isLocale } from '#lib/i18n/index.js';
	import { locale } from '#lib/i18n/t.js';

	let { id, class: className }: { id: string; class?: ClassValue } = $props();

	let changing = $state(false);

	async function change(event: Event & { currentTarget: HTMLSelectElement }) {
		const chosen = event.currentTarget.value;
		if (!isLocale(chosen)) return;
		saveLocale(chosen);
		changing = true;
		try {
			await invalidate(LOCALE_DEPENDENCY); // the root layout loads the new language's messages
		} finally {
			changing = false;
		}
	}
</script>

<select {id} class={['select', className]} value={locale()} onchange={change} aria-busy={changing}>
	{#each Object.values(Locale) as option (option)}
		<!-- lang: screen readers pronounce each name in its own language. -->
		<option value={option} lang={option}>{LOCALE_NAMES[option]}</option>
	{/each}
</select>
