<script lang="ts">
	// One group: sticky heading plus its contacts, lazy-loaded in chunks as the placeholder below scrolls
	// into view. The placeholder reserves the height still to come, so the page doesn't jump.
	import { SectionLoadState, sectionId, type Contact, type ContactChange, type SectionChunkResponse } from '#lib/contacts.js';
	import ContactRow from './ContactRow.svelte';
	import Highlight from './Highlight.svelte';

	// `search`: only matching contacts are loaded, and matches are highlighted. The page gives every search its
	// own sections (keyed on it), so a section never mixes results of two searches.
	let {
		name,
		count,
		first = false,
		search = '',
		onchanged
	}: {
		name: string;
		count: number;
		first?: boolean;
		search?: string;
		onchanged: (change: ContactChange) => void;
	} = $props();

	let contacts = $state<Contact[]>([]);
	let loadState = $state<SectionLoadState>(SectionLoadState.NotStarted);
	/** List position to continue after (from the last chunk). */
	let next = $state<string | null>(null);
	let remaining = $state(0);
	let failed = $state(false);
	/** Bumped by reload(), so answers to requests from before a reload are ignored. */
	let generation = $state(0);
	let loading = false;
	/** The mounted rows by contact id, so a contact can be scrolled to and its details opened. */
	const rows: Record<number, ContactRow> = $state({});

	const placeholderRows = $derived(loadState === SectionLoadState.NotStarted ? count : remaining);

	async function loadMore() {
		if (loading || loadState === SectionLoadState.Complete) return;
		loading = true;
		failed = false;
		const started = generation;
		const query = new URLSearchParams({ name });
		if (next) query.set('after', next);
		if (search) query.set('q', search);
		try {
			const response = await fetch(`/contacts/group?${query}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const chunk: SectionChunkResponse = await response.json();
			if (started !== generation) return;
			contacts.push(...chunk.contacts);
			remaining = chunk.remaining;
			next = chunk.next;
			loadState = chunk.next ? SectionLoadState.Partial : SectionLoadState.Complete;
		} catch {
			if (started === generation) failed = true;
		} finally {
			loading = false;
		}
	}

	/** Forget the loaded rows and load again from the start (e.g. after Undo put a contact back). */
	export function reload() {
		generation++;
		contacts = [];
		next = null;
		loadState = SectionLoadState.NotStarted;
		failed = false;
		loading = false;
	}

	/** Remove a deleted contact from the loaded rows. */
	export function remove(id: number) {
		contacts = contacts.filter((contact) => contact.id !== id);
	}

	/**
	 * Loads chunks until the contact's row is fetched (or the section is fully loaded or failed),
	 * then scrolls it into view and opens its details. Used by the "View" button after creating.
	 */
	export async function reveal(id: number) {
		while (!contacts.some((contact) => contact.id === id) && loadState !== SectionLoadState.Complete && !failed) {
			if (loading) {
				// A scroll-triggered load is already running; wait for it to finish before the next chunk.
				await new Promise((resolve) => setTimeout(resolve, 20));
			} else {
				await loadMore();
			}
		}
		rows[id]?.reveal();
	}

	// Calls loadMore when the element comes within 300px of the screen.
	function loadWhenVisible(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) loadMore();
		}, { rootMargin: '300px 0px' });
		observer.observe(node);
		return () => observer.disconnect();
	}
</script>

<section id={sectionId(name)} aria-labelledby="{sectionId(name)}-heading" class="scroll-mt-(--list-sticky-top)">
	<h2
		id="{sectionId(name)}-heading"
		class={[
			// Sticks just below the sticky top bar + search bar (--list-sticky-top in app.css).
			'sticky top-(--list-sticky-top) z-10 bg-base-200/95 px-4 py-1 text-sm font-bold text-primary backdrop-blur',
			first && 'rounded-t-box md:rounded-none'
		]}
	>
		<Highlight text={name} {search} />
	</h2>
	<ul>
		{#each contacts as contact (contact.id)}
			<ContactRow bind:this={rows[contact.id]} {contact} {search} {onchanged} ondeleted={remove} />
		{/each}
	</ul>
	{#if loadState !== SectionLoadState.Complete}
		<!-- Re-created after every chunk, so a placeholder that is still on screen triggers the next load. -->
		{#key `${generation}:${next}`}
			<div
				{@attach loadWhenVisible}
				aria-busy={!failed}
				style="--rows: {placeholderRows}"
				class="flex h-[calc(var(--rows)*var(--contact-row-height))] items-start justify-center pt-4"
			>
				{#if failed}
					<button type="button" class="btn btn-sm" onclick={loadMore}>Couldn't load contacts. Retry</button>
				{:else}
					<span class="loading loading-dots loading-sm text-base-content/40"></span>
					<span class="sr-only">Loading contacts…</span>
				{/if}
			</div>
		{/key}
	{/if}
</section>
