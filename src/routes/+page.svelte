<script lang="ts">
	import { enhance } from '$app/forms';
	import { ActionOutcome, groupKey } from '#lib/contacts.js';
	import GroupSection from '#lib/components/GroupSection.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The mounted group sections by groupKey, to remove/reload rows after delete and undo. */
	const sections: Record<string, GroupSection> = $state({});

	const groupKeys = $derived(new Set(data.groups.map((group) => groupKey(group.name))));
	const outcome = $derived(form?.outcome);
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
				{data.total}
				{data.total === 1 ? 'contact' : 'contacts'}
			</p>
		</div>
		<!-- Mock: becomes "new contact" in issue #5 -->
		<button type="button" class="btn btn-primary" disabled>+ New</button>
	</div>

	{#if form?.outcome === ActionOutcome.Deleted}
		<div role="status" class="mb-4 alert flex items-center justify-between alert-soft alert-success">
			<span>Contact deleted.</span>
			<form
				method="POST"
				action="?/restore"
				use:enhance={() => {
					return async ({ result, update }) => {
						const restoredGroup =
							result.type === 'success' && result.data?.outcome === ActionOutcome.Restored
								? groupKey((result.data.restored as { groupName: string }).groupName)
								: undefined;
						const reloadSection = restoredGroup !== undefined && groupKeys.has(restoredGroup);
						await update();
						// A new section loads itself; an existing one reloads so the contact reappears in its place.
						if (reloadSection) sections[restoredGroup].reload();
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

	<!-- Always visible: sticks below the top bar while the list scrolls under it.
	     Mock: search and filters arrive with issue #7. Read-only (not disabled) so it stays clearly visible.
	     Its height (with padding) is --search-bar-height in app.css; group headings stick right below it. -->
	<div class="sticky top-16 z-20 -mx-1 bg-base-200 px-1 py-2">
		<label class="input w-full border-base-content/20 bg-base-100">
			<svg class="h-5 w-5 opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<circle cx="11" cy="11" r="7"></circle>
				<path d="m20 20-3.5-3.5"></path>
			</svg>
			<input type="search" placeholder="Search contacts" aria-label="Search contacts" readonly />
		</label>
	</div>

	{#if data.groups.length === 0}
		<div class="rounded-box bg-base-100 p-10 text-center text-base-content/60 shadow-sm">No contacts yet.</div>
	{:else}
		<!-- No overflow clipping on this box: the row option menus must be able to stick out of it. -->
		<div class="rounded-box bg-base-100 shadow-sm">
			<div class="hidden grid-cols-[1fr_1fr_minmax(11rem,1fr)_1.5fr_2rem] gap-4 border-b border-base-content/10 px-4 py-3 text-sm font-semibold text-base-content/60 md:grid">
				<span>Group</span><span>Location</span><span>Phone number</span><span>Description</span><span class="sr-only">Options</span>
			</div>

			{#each data.groups as group, i (groupKey(group.name))}
				<GroupSection bind:this={sections[groupKey(group.name)]} name={group.name} count={group.count} first={i === 0} />
			{/each}
		</div>
	{/if}
</div>
