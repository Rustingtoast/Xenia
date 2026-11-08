<script lang="ts">
	// Side index: jump to the groups starting with a letter. Letters without contacts are greyed out.
	import { INDEX_LETTERS, sectionId } from '#lib/contacts.js';

	let { letters }: { letters: Set<string> } = $props();
</script>

<nav aria-label="Jump to letter" class="fixed top-18 right-0.5 bottom-2 z-20 flex flex-col items-center justify-center md:right-3">
	{#each INDEX_LETTERS as letter (letter)}
		{#if letters.has(letter)}
			<a
				href="#{sectionId(letter)}"
				class="flex h-[min(1.5rem,3.2dvh)] w-6 items-center justify-center rounded-full text-xs font-semibold text-primary hover:bg-primary hover:text-primary-content md:w-7 md:text-sm"
				>{letter}</a
			>
		{:else}
			<span
				aria-hidden="true"
				class="flex h-[min(1.5rem,3.2dvh)] w-6 items-center justify-center text-xs text-base-content/25 md:w-7 md:text-sm"
				>{letter}</span
			>
		{/if}
	{/each}
</nav>
