<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import GroupList from '#lib/components/GroupList.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { GroupCount } from '#lib/contacts.js';
	import { DOCKED_QUERY, GroupListMode } from '#lib/group-list.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/** The signed-in user (from +layout.server.ts), or null on the login/register pages. */
	const user = $derived(page.data.user);
	/** Pages that show contacts provide their groups; only those get the Group list. */
	const groups = $derived(page.data.groups as GroupCount[] | undefined);
	const search = $derived((page.data.search as string | undefined) ?? '');

	let groupListMode = $state<GroupListMode>(GroupListMode.Auto);
	const docked = new MediaQuery(DOCKED_QUERY, false);
	const groupListShown = $derived(
		groupListMode === GroupListMode.Open || (groupListMode === GroupListMode.Auto && docked.current)
	);

	function toggleGroupList() {
		if (groupListShown) closeGroupList();
		else groupListMode = docked.current ? GroupListMode.Auto : GroupListMode.Open;
	}

	function closeGroupList() {
		// Smaller screens fall back to Auto (= hidden there), so the drawer doesn't cover the page after a resize.
		groupListMode = docked.current ? GroupListMode.Closed : GroupListMode.Auto;
	}
</script>

<!-- Sticky, so the docked Group list (which starts below it) always lines up with it. -->
<header class="navbar sticky top-0 z-20 min-h-16 gap-1 bg-base-100 shadow-sm">
	{#if groups}
		<button
			type="button"
			class="btn btn-square btn-ghost"
			aria-label={groupListShown ? 'Close group list' : 'Open group list'}
			title={groupListShown ? 'Close group list' : 'Open group list'}
			aria-controls="group-list"
			aria-expanded={groupListShown}
			onclick={toggleGroupList}
		>
			<svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
				stroke-width="2" stroke-linecap="round" aria-hidden="true">
				<path d="M4 6h16M4 12h16M4 18h16"></path>
			</svg>
		</button>
	{/if}
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl">Xenia</a>
	</div>
	{#if user}
		<!-- Account dropdown: a person icon that reveals the email and the Log out action. -->
		<div class="dropdown dropdown-end">
			<div
				tabindex="0"
				role="button"
				class="btn btn-circle btn-ghost"
				aria-label="Account"
				title="Account"
			>
				<svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
					<circle cx="12" cy="7" r="4"></circle>
				</svg>
			</div>
			<div
				tabindex="-1"
				class="dropdown-content z-30 my-1 w-64 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-content/10"
			>
				<p class="truncate px-2 py-1 text-sm text-base-content/60" title={user.email}>{user.email}</p>
				<form method="POST" action="?/logout">
					<button class="btn btn-ghost btn-sm w-full justify-start text-error">Log out</button>
				</form>
			</div>
		</div>
	{/if}
	<ThemeToggle />
</header>

{#if groups}
	<GroupList {groups} {search} mode={groupListMode} onclose={closeGroupList} />
{/if}

<!-- Always centered on the full width: the Group list lies on top and never moves it. -->
<main class="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
	{@render children()}
</main>
