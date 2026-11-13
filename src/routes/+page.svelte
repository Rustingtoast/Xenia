<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { ActionOutcome, SEARCH_MAX_LENGTH, groupKey, normalizeSearch } from '#lib/contacts.js';
	import { pageAction } from '#lib/forms.js';
	import GroupSection from '#lib/components/GroupSection.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Copy of `form`: SvelteKit clears it on navigation, and the Undo button must survive a search.
	// svelte-ignore state_referenced_locally
	let notice = $state(form);
	$effect.pre(() => {
		if (form) notice = form;
	});

	/** The mounted group sections by groupKey, to remove/reload rows after delete and undo. */
	const sections: Record<string, GroupSection> = $state({});

	const groupKeys = $derived(new Set(data.groups.map((group) => groupKey(group.name))));
	/** True while an Undo request is running: the button is disabled so a double tap can't restore twice. */
	let restoring = $state(false);

	// The search lives in the URL (?q=…), so reload/back keep it; applied shortly after typing stops.
	const SEARCH_DELAY_MS = 250;
	// svelte-ignore state_referenced_locally
	let searchText = $state(data.search);
	let searchInput: HTMLInputElement;
	let searchBar: HTMLElement;
	let results: HTMLElement;
	/** Debounce timer; undefined while idle. */
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	/** Search in flight; undefined when none. */
	let loadingSearch: string | undefined;
	/** Monotonic counter for ignoring stale responses. */
	let searchRequests = 0;

	/** Syncs the box to the search the list shows (normalized). */
	function showAppliedSearch() {
		if (normalizeSearch(searchText) !== data.search) searchText = data.search;
	}

	// Follow searches changed outside the box (back, link), unless one is in flight or typing hasn't paused.
	$effect(() => {
		void data.search;
		untrack(() => {
			if (loadingSearch === undefined && searchTimer === undefined) showAppliedSearch();
		});
	});

	async function applySearch(text: string) {
		clearTimeout(searchTimer);
		searchTimer = undefined;
		const search = normalizeSearch(text);
		// Compare with the search in flight, not the one shown: clearing while "bern" loads must still load
		// the empty search, or "bern" arrives after all.
		if (search === (loadingSearch ?? data.search)) return;

		const url = new URL(page.url.href); // page.url is read-only
		if (search) url.searchParams.set('q', search);
		else url.searchParams.delete('q');
		url.hash = ''; // drop a #group-… left by a Group list jump, so reload doesn't scroll to it

		const request = ++searchRequests;
		loadingSearch = search;
		let arrived = false;
		try {
			// replace: no history entry per search. reset:false keeps focus and scroll (showFirstResults fixes the scroll).
			await goto(url, { replace: true, reset: false });
			arrived = true;
		} catch {
			// Overtaken by another navigation (e.g. back button).
		}
		if (request !== searchRequests) return; // a newer search is loading: it finishes up
		loadingSearch = undefined;
		if (searchTimer === undefined) showAppliedSearch();
		if (arrived) showFirstResults();
	}

	/** After a new search, scroll the list's start just below the search bar so results begin at the first match. */
	function showFirstResults() {
		const hidden = searchBar.getBoundingClientRect().bottom - results.getBoundingClientRect().top;
		if (hidden > 1) window.scrollBy(0, -hidden);
	}

	function searchLater() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => applySearch(searchText), SEARCH_DELAY_MS);
	}

	function clearSearch() {
		searchText = '';
		applySearch('');
		searchInput.focus();
	}
</script>

<svelte:head>
	<title>Phonebook · Xenia</title>
</svelte:head>

<div class="mx-auto max-w-xl md:max-w-none">
	<div class="mb-2 flex items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">Phonebook</h1>
			<p id="contact-count" class="text-sm text-base-content/60">
				{#if data.search}
					{data.matches} of {data.total} {data.total === 1 ? 'contact' : 'contacts'}
				{:else}
					{data.total} {data.total === 1 ? 'contact' : 'contacts'}
				{/if}
			</p>
		</div>
		<!-- Placeholder: the "new contact" form is not built yet. -->
		<button type="button" class="btn btn-primary" disabled>+ New</button>
	</div>

	{#if notice?.outcome === ActionOutcome.Deleted}
		<div role="status" class="mb-4 alert flex items-center justify-between alert-soft alert-success">
			<span>Contact deleted.</span>
			<form
				method="POST"
				action={pageAction(page.url, 'restore')}
				use:enhance={({ cancel }) => {
					// One restore at a time: a double tap would send a second request whose "can't restore"
					// answer arrives last and replaces "Contact restored.".
					if (restoring) {
						cancel();
						return;
					}
					restoring = true;
					return async ({ result, update }) => {
						try {
							const restoredGroup =
								result.type === 'success' && result.data?.outcome === ActionOutcome.Restored
									? groupKey((result.data.restored as { groupName: string }).groupName)
									: undefined;
							const reloadSection = restoredGroup !== undefined && groupKeys.has(restoredGroup);
							await update({ navigate: false }); // keep the current page (its search may have changed)
							// A new section loads itself; an existing one reloads so the contact reappears in its place.
							if (reloadSection) sections[restoredGroup].reload();
						} finally {
							restoring = false;
						}
					};
				}}
			>
				<input type="hidden" name="token" value={notice.undoToken} />
				<button class="btn btn-sm btn-success" disabled={restoring}>Undo</button>
			</form>
		</div>
	{:else if notice?.outcome === ActionOutcome.Restored}
		<div role="status" class="mb-4 alert alert-soft alert-success">Contact restored.</div>
	{:else if notice?.outcome === ActionOutcome.RestoreFailed}
		<div role="alert" class="mb-4 alert alert-soft alert-warning">This contact can no longer be restored.</div>
	{/if}

	<!-- Searches group, location, phone (separator-insensitive) and description. -->
	<div bind:this={searchBar} class="sticky top-16 z-20 -mx-1 bg-base-200 px-1 py-2">
		<label class="input w-full border-base-content/20 bg-base-100">
			<svg class="h-5 w-5 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<circle cx="11" cy="11" r="7"></circle>
				<path d="m20 20-3.5-3.5"></path>
			</svg>
			<input
				bind:this={searchInput}
				bind:value={searchText}
				type="search"
				placeholder="Search contacts"
				aria-label="Search contacts"
				maxlength={SEARCH_MAX_LENGTH}
				autocomplete="off"
				oninput={searchLater}
				onkeydown={(event) => {
					if (event.key === 'Enter') applySearch(searchText);
					if (event.key === 'Escape' && searchText) {
						event.preventDefault();
						clearSearch();
					}
				}}
			/>
			{#if searchText}
				<button type="button" class="btn btn-circle btn-ghost btn-xs" aria-label="Clear search" onclick={clearSearch}>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18"></path>
					</svg>
				</button>
			{/if}
		</label>
	</div>

	<!-- Bound for showFirstResults to measure. -->
	<div bind:this={results}>
		{#if data.total === 0}
			<div class="rounded-box bg-base-100 p-10 text-center text-base-content/60 shadow-sm">No contacts yet.</div>
		{:else if data.groups.length === 0}
			<div class="rounded-box bg-base-100 p-10 text-center shadow-sm">
				<p class="text-base-content/60">No contacts match “{data.search}”.</p>
				<button type="button" class="btn mt-4 btn-sm" onclick={clearSearch}>Clear search</button>
			</div>
		{:else}
			<!-- No overflow clipping: row menus must stick out. -->
			<div class="rounded-box bg-base-100 shadow-sm">
				<div class="hidden grid-cols-[1fr_1fr_minmax(11rem,1fr)_1.5fr_2rem] gap-4 border-b border-base-content/10 px-4 py-3 text-sm font-semibold text-base-content/60 md:grid">
					<span>Group</span><span>Location</span><span>Phone number</span><span>Description</span><span class="sr-only">Options</span>
				</div>

				<!-- Keyed on group and search: a new search gets fresh sections that load only matching contacts. -->
				{#each data.groups as group, i (`${groupKey(group.name)}\n${data.search}`)}
					<GroupSection
						bind:this={sections[groupKey(group.name)]}
						name={group.name}
						count={group.count}
						first={i === 0}
						search={data.search}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>
