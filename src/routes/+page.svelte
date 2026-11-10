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

	// What the banner shows: the answer to the last delete/undo. A copy of `form`, because SvelteKit empties
	// `form` on every navigation and a search is one: looking for the contact you just deleted must not take
	// the Undo button away.
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

	// Search (issue #7). The text box updates as you type; the search itself lives in the URL (?q=…), so reload
	// and the back button keep it. It is applied shortly after typing stops, without a history entry per key.
	const SEARCH_DELAY_MS = 250;
	// Starts with the current search (also on the server, so the box isn't empty on load); showAppliedSearch
	// keeps it in step afterwards.
	// svelte-ignore state_referenced_locally
	let searchText = $state(data.search);
	let searchInput: HTMLInputElement;
	let searchBar: HTMLElement;
	let results: HTMLElement;
	/** Runs when typing has paused; undefined when nothing is waiting. */
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	/** The search that was asked for and is still loading; undefined when none is. */
	let loadingSearch: string | undefined;
	/** Counts the searches asked for, to tell whether one that finished is still the latest. */
	let searchRequests = 0;

	/** Puts the search the list shows into the box. "Zur " with a trailing space is still the search "Zur". */
	function showAppliedSearch() {
		if (normalizeSearch(searchText) !== data.search) searchText = data.search;
	}

	// Follow searches that change from outside the box (back button, a link). Not while the box is ahead of
	// the list (its search is still loading, or typing hasn't paused yet): what was typed meanwhile stays.
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
		// Compared with the search that is on its way, not only the one shown: clearing the box while "bern"
		// is still loading has to load the empty search, or "bern" arrives after all.
		if (search === (loadingSearch ?? data.search)) return;

		const url = new URL(page.url.href); // page.url is read-only
		if (search) url.searchParams.set('q', search);
		else url.searchParams.delete('q');
		url.hash = ''; // a #group-… from an earlier Group list jump would scroll a reload to that group

		const request = ++searchRequests;
		loadingSearch = search;
		let arrived = false;
		try {
			// replace: no history entry per search. reset: false keeps the focus in the box; it also keeps the
			// scroll position, which showFirstResults corrects.
			await goto(url, { replace: true, reset: false });
			arrived = true;
		} catch {
			// Overtaken by another navigation (e.g. the back button): that one decides what is shown.
		}
		if (request !== searchRequests) return; // a newer search is loading: it finishes up
		loadingSearch = undefined;
		if (searchTimer === undefined) showAppliedSearch();
		if (arrived) showFirstResults();
	}

	/**
	 * After a new search: if the start of the list is scrolled away under the search bar, bring it back to
	 * just below it, so the results are shown from the first match. The search bar itself stays where it is.
	 */
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

<!-- Phone layout: a centered, phone-wide column (36rem), also on wider windows below md. md+: full width. -->
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
		<!-- Mock: becomes "new contact" in issue #5 -->
		<button type="button" class="btn btn-primary" disabled>+ New</button>
	</div>

	<!-- Banner colours (readable text, brighter green) are set once for all soft alerts in src/app.css. -->
	{#if notice?.outcome === ActionOutcome.Deleted}
		<div role="status" class="mb-4 alert flex items-center justify-between alert-soft alert-success">
			<span>Contact deleted.</span>
			<form
				method="POST"
				action={pageAction(page.url, 'restore')}
				use:enhance={({ cancel }) => {
					// One restore at a time. Otherwise a double tap sends a second request whose answer ("can't
					// restore": the contact is back already) arrives last and replaces "Contact restored.".
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
							await update({ navigate: false }); // the answer belongs to the page as it is now (see ContactRow)
							// A new section loads itself; an existing one reloads so the contact reappears in its place.
							if (reloadSection) sections[restoredGroup].reload();
						} finally {
							restoring = false;
						}
					};
				}}
			>
				<input type="hidden" name="token" value={notice.undoToken} />
				<!-- Solid green (daisyUI success); its edge is set in src/app.css so it stands out on the green banner. -->
				<button class="btn btn-sm btn-success" disabled={restoring}>Undo</button>
			</form>
		</div>
	{:else if notice?.outcome === ActionOutcome.Restored}
		<div role="status" class="mb-4 alert alert-soft alert-success">Contact restored.</div>
	{:else if notice?.outcome === ActionOutcome.RestoreFailed}
		<div role="alert" class="mb-4 alert alert-soft alert-warning">This contact can no longer be restored.</div>
	{/if}

	<!-- Always visible: sticks below the top bar while the list scrolls under it. Searches group, location,
	     phone number (also ignoring how it's written) and description; choosing fields is issue #9.
	     Its height (with padding) is --search-bar-height in app.css; group headings stick right below it. -->
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

	<!-- The list, or what is shown instead of it. showFirstResults measures where it starts. -->
	<div bind:this={results}>
		{#if data.total === 0}
			<div class="rounded-box bg-base-100 p-10 text-center text-base-content/60 shadow-sm">No contacts yet.</div>
		{:else if data.groups.length === 0}
			<div class="rounded-box bg-base-100 p-10 text-center shadow-sm">
				<p class="text-base-content/60">No contacts match “{data.search}”.</p>
				<button type="button" class="btn mt-4 btn-sm" onclick={clearSearch}>Clear search</button>
			</div>
		{:else}
			<!-- No overflow clipping on this box: the row option menus must be able to stick out of it. -->
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
