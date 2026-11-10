<script lang="ts">
	// Text with the parts matching the search highlighted. Without a search it is just the text: nothing is
	// split or looped over (the list renders several of these per contact).
	// phoneNumber: also highlights matches that ignore separators ("5550101" in "+1 555-0101").
	import { highlightParts, phoneHighlightParts } from '#lib/contacts.js';

	let { text, search = '', phoneNumber = false }: { text: string; search?: string; phoneNumber?: boolean } = $props();

	const parts = $derived(phoneNumber ? phoneHighlightParts(text, search) : highlightParts(text, search));
</script>

{#if search}{#each parts as part, i (i)}{#if part.match}<mark class="search-match">{part.text}</mark>{:else}{part.text}{/if}{/each}{:else}{text}{/if}
