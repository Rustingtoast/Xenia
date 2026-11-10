<script lang="ts">
	// The Group list: every group with its number of contacts; tap one to jump to its section.
	// It always lies on top of the page (position: fixed), so opening/closing it never moves the contacts.
	// - Docked-wide screens (`docked:`, ≥ 86rem): a panel below the top bar, in the empty space left of
	//   the contacts. Shown by default; the hamburger hides it.
	// - Smaller screens: a drawer that slides in over the page with a backdrop, hidden until the hamburger
	//   opens it; picking a group, the backdrop, ✕ or Escape close it.
	import { sectionId, type GroupCount } from '#lib/contacts.js';
	import { GroupListMode } from '#lib/group-list.js';
	import ExportDialog from './ExportDialog.svelte';
	import Highlight from './Highlight.svelte';
	import SettingsDialog from './SettingsDialog.svelte';

	let {
		groups,
		search = '',
		mode,
		onclose
	}: { groups: GroupCount[]; search?: string; mode: GroupListMode; onclose: () => void } = $props();

	let exportDialog: ExportDialog;
	let settingsDialog: SettingsDialog;

	function closeOnEscape(event: KeyboardEvent) {
		// Escape in an open modal (Export, Settings) closes only the modal, not the drawer behind it.
		if (event.key !== 'Escape' || mode !== GroupListMode.Open || document.querySelector('dialog[open]')) return;
		onclose();
	}
</script>

<svelte:window onkeydown={closeOnEscape} />

{#if mode === GroupListMode.Open}
	<!-- Smaller screens only: tapping beside the drawer closes it. -->
	<button type="button" class="fixed inset-0 z-30 bg-black/40 docked:hidden" aria-label="Close group list" tabindex="-1" onclick={onclose}
	></button>
{/if}

<aside
	id="group-list"
	aria-label="Group list"
	class={[
		'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-base-100 shadow-xl transition-transform',
		// Docked: below the sticky top bar (h-16), 14rem wide, no shadow.
		'docked:top-16 docked:z-20 docked:w-56 docked:border-r docked:border-base-content/10 docked:shadow-none docked:transition-none',
		mode === GroupListMode.Open ? 'translate-x-0' : '-translate-x-full max-docked:invisible',
		mode === GroupListMode.Auto && 'docked:visible docked:translate-x-0',
		mode === GroupListMode.Closed && 'docked:hidden'
	]}
>
	<div class="flex items-center justify-between border-b border-base-content/10 px-4 py-3">
		<h2 class="font-bold">Group list</h2>
		<button type="button" class="btn btn-square btn-ghost btn-sm docked:hidden" aria-label="Close group list" onclick={onclose}>
			<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<path d="M6 6l12 12M18 6L6 18"></path>
			</svg>
		</button>
	</div>

	{#if groups.length === 0}
		<p class="flex-1 px-4 py-3 text-sm text-base-content/60">{search ? 'No matching groups.' : 'No groups yet.'}</p>
	{:else}
		<ul class="menu w-full flex-1 flex-nowrap overflow-y-auto overscroll-contain">
			{#each groups as group (sectionId(group.name))}
				<li>
					<!-- On smaller screens, jumping to a group also closes the drawer. -->
					<a href="#{sectionId(group.name)}" class="flex justify-between gap-2" onclick={() => mode === GroupListMode.Open && onclose()}>
						<span class="truncate"><Highlight text={group.name} {search} /></span>
						<span class="badge badge-ghost badge-sm">{group.count}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Bottom of the Group list, centered: Export above Settings. Both open a modal. -->
	<div class="flex flex-col items-center gap-1 border-t border-base-content/10 p-3">
		<button type="button" class="btn w-full btn-ghost" onclick={() => exportDialog.open()}>
			<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>
			</svg>
			Export
		</button>
		<button type="button" class="btn w-full btn-ghost" onclick={() => settingsDialog.open()}>
			<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="3"></circle>
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
			</svg>
			Settings
		</button>
	</div>
</aside>

<ExportDialog bind:this={exportDialog} />
<SettingsDialog bind:this={settingsDialog} />
