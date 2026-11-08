<script lang="ts">
	import { enhance } from '$app/forms';
	import { ActionOutcome } from '#lib/contacts.js';
	import LetterSection from '#lib/components/LetterSection.svelte';
	import SideIndex from '#lib/components/SideIndex.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The mounted letter sections, to remove/reload rows after delete and undo. */
	const sections: Record<string, LetterSection> = {};

	const letters = $derived(new Set(data.letterCounts.map(([letter]) => letter)));
	const firstLetter = $derived(data.letterCounts[0]?.[0]);
	const outcome = $derived(form?.outcome);
</script>

<svelte:head>
	<title>Phonebook · Xenia</title>
</svelte:head>

<!-- Right margin keeps everything clear of the fixed side index. -->
<div class="mr-6 md:mr-8">
	<div class="mb-4 flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">Phonebook</h1>
			<p id="contact-count" class="text-sm text-base-content/60">
				{data.total}
				{data.total === 1 ? 'contact' : 'contacts'}
			</p>
		</div>
		<!-- Mock: becomes "new contact" in issue #5 -->
		<button type="button" class="btn btn-primary" disabled>+ New</button>
	</div>

	<!-- Mock: search and filters arrive with issue #7. Read-only (not disabled) so it stays clearly visible. -->
	<label class="input mb-4 w-full border-base-content/20 bg-base-100">
		<svg class="h-5 w-5 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
			<circle cx="11" cy="11" r="7"></circle>
			<path d="m20 20-3.5-3.5"></path>
		</svg>
		<input type="search" placeholder="Search group, location or number" aria-label="Search contacts" readonly />
	</label>

	{#if form?.outcome === ActionOutcome.Deleted}
		<div role="status" class="mb-4 alert flex items-center justify-between alert-soft alert-success">
			<span>Contact deleted.</span>
			<form
				method="POST"
				action="?/restore"
				use:enhance={() => {
					return async ({ result, update }) => {
						const hadSection = (letter: string) => letter in sections && letters.has(letter);
						const restoredLetter =
							result.type === 'success' && result.data?.outcome === ActionOutcome.Restored
								? (result.data.restored as { letter: string }).letter
								: undefined;
						const reloadSection = restoredLetter !== undefined && hadSection(restoredLetter);
						await update();
						// A new section loads itself; an existing one reloads so the contact reappears in its place.
						if (reloadSection) sections[restoredLetter].reload();
					};
				}}
			>
				<input type="hidden" name="token" value={form.undoToken} />
				<button class="btn btn-sm">Undo</button>
			</form>
		</div>
	{:else if outcome === ActionOutcome.Restored}
		<div role="status" class="mb-4 alert alert-soft alert-success">Contact restored.</div>
	{:else if outcome === ActionOutcome.RestoreFailed}
		<div role="alert" class="mb-4 alert alert-soft alert-warning">This contact can no longer be restored.</div>
	{/if}

	{#if data.letterCounts.length === 0}
		<div class="rounded-box bg-base-100 p-10 text-center text-base-content/60 shadow-sm">No contacts yet.</div>
	{:else}
		<SideIndex {letters} />

		<!-- No overflow clipping on this box: the row option menus must be able to stick out of it. -->
		<div class="rounded-box bg-base-100 shadow-sm">
			<div class="hidden grid-cols-[1fr_1fr_1fr_2rem] gap-4 border-b border-base-content/10 px-4 py-3 text-sm font-semibold text-base-content/60 md:grid">
				<span>Group</span><span>Location</span><span>Phone number</span><span class="sr-only">Options</span>
			</div>

			{#each data.letterCounts as [letter, count] (letter)}
				<LetterSection bind:this={sections[letter]} {letter} {count} first={letter === firstLetter} />
			{/each}
		</div>
	{/if}
</div>
