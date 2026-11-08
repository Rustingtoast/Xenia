<script lang="ts">
	import '../app.css';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<header class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl">Xenia</a>
	</div>
	<ThemeToggle />
</header>

<main class="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
	{@render children()}
</main>
