<script lang="ts">
	// One phonebook row with its options menu (⋮), delete confirmation and contact details dialogs.
	// Tapping the entry (anywhere except the number, which calls, and the ⋮ menu) opens the details.
	// Phones: number, location, description (left-aligned, in a centered column, see +page.svelte).
	// Wider screens: Group | Location | Phone | Description columns + ⋮.
	// Every line is cut off with "…" rather than wrapping, so all rows have the same height: it must match
	// --contact-row-height in app.css (lazy-loading placeholders rely on it).
	import { enhance } from '$app/forms';
	import { telHref, type Contact } from '#lib/contacts.js';
	import ContactDetailsDialog from './ContactDetailsDialog.svelte';

	let { contact, ondeleted }: { contact: Contact; ondeleted: (id: number) => void } = $props();

	let dropdown: HTMLDivElement;
	let menu: HTMLUListElement;
	let dialog: HTMLDialogElement;
	let detailsDialog: ContactDetailsDialog;

	// A click anywhere on the entry opens the details, unless it was on something with its own job:
	// the number (calls), the ⋮ menu, a button, or inside one of the row's dialogs.
	function openDetailsFromRow(event: MouseEvent) {
		if ((event.target as Element).closest('a, button, [role="button"], .dropdown, dialog')) return;
		detailsDialog.open();
	}

	// Open the menu upward when there isn't room below (last rows on screen).
	function placeMenu() {
		const below = window.innerHeight - dropdown.getBoundingClientRect().bottom;
		dropdown.classList.toggle('dropdown-top', below < menu.offsetHeight + 16);
	}

	function confirmDelete() {
		// Drop focus from the ⋮ menu first, so the focus-based dropdown closes behind the dialog.
		(document.activeElement as HTMLElement | null)?.blur();
		dialog.showModal();
	}
</script>

<!-- The click handler is a mouse/touch convenience; keyboard and screen-reader users have the details button
     (the description line) below, so no key handler or role is needed on the <li> itself. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<li
	id="contact_{contact.id}"
	class="flex cursor-pointer items-center gap-2 border-t border-base-content/5 px-4 py-3 transition-colors hover:bg-base-200/50 md:grid md:grid-cols-[1fr_1fr_minmax(11rem,1fr)_1.5fr_2rem] md:gap-4"
	onclick={openDetailsFromRow}
>
	<!-- Phones: three left-aligned lines, most important first: number (large, bold), location, description
	     (smallest, muted). The group is not repeated here: the section heading above already shows it.
	     md+: these become the Group | Location | Phone | Description columns. -->
	<div class="flex min-w-0 flex-1 flex-col md:contents">
		<!-- Only as wide as the number (self-start), so tapping beside it opens the details instead of calling. -->
		<a
			href={telHref(contact.phoneNumber)}
			class="link max-w-full self-start truncate text-lg leading-7 font-semibold tabular-nums link-hover md:order-3 md:justify-self-start md:font-mono md:text-base md:font-normal"
			>{contact.phoneNumber}</a
		>
		<span class="hidden min-w-0 md:order-1 md:block"
			><span class="badge max-w-full badge-soft badge-md badge-primary"><span class="truncate">{contact.groupName}</span></span></span
		>
		<span class="min-w-0 truncate text-sm leading-6 text-base-content/70 md:order-2 md:text-base md:text-base-content">{contact.location}</span>
		<!-- Always one line, cut off with "…". It is also the details button for keyboard/screen-reader users. -->
		<button
			type="button"
			class={[
				'block w-full min-w-0 cursor-pointer truncate text-left text-xs leading-5 md:order-4 md:text-sm',
				contact.description ? 'text-base-content/55' : 'text-base-content/35 italic'
			]}
			aria-haspopup="dialog"
			aria-label="Details for {contact.phoneNumber}: {contact.description || 'No description'}"
			title="Show all details"
			onclick={() => detailsDialog.open()}>{contact.description || 'No description'}</button
		>
	</div>

	<!-- daisyUI focus dropdown: opens while the ⋮ button has focus, closes when focus leaves.
	     A div with tabindex (not a <button>) because Safari doesn't focus buttons on click.
	     focus-within:z-40 lifts the open menu above the rows below it. -->
	<div class="dropdown dropdown-end focus-within:z-40 md:order-5" bind:this={dropdown}>
		<div
			tabindex="0"
			role="button"
			class="btn btn-square btn-ghost btn-sm"
			aria-label="Options for {contact.phoneNumber}"
			title="Options"
			onfocus={placeMenu}
		>
			<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle>
			</svg>
		</div>
		<ul
			tabindex="-1"
			bind:this={menu}
			class="dropdown-content menu z-30 my-1 w-40 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-content/10"
		>
			<!-- Mock: editing arrives with issue #6. -->
			<li class="menu-disabled" title="Coming soon">
				<span aria-disabled="true">
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
					</svg>
					Edit
				</span>
			</li>
			<li>
				<button type="button" class="text-error" onclick={confirmDelete}>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path>
					</svg>
					Delete
				</button>
			</li>
		</ul>
	</div>

	<!-- Bottom sheet on phones, centered dialog on larger screens. Esc, Cancel or tapping outside closes it. -->
	<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="contact_{contact.id}_delete_title">
		<div class="modal-box">
			<h3 id="contact_{contact.id}_delete_title" class="text-lg font-bold">Delete this contact?</h3>
			<p class="py-4">
				<span class="font-medium">{contact.phoneNumber}</span>
				<span class="text-base-content/60">· {contact.groupName} · {contact.location}</span>
				<br />
				<span class="text-sm text-base-content/60">This can't be undone.</span>
			</p>
			<div class="modal-action">
				<form method="dialog"><button class="btn">Cancel</button></form>
				<form
					method="POST"
					action="?/delete"
					use:enhance={() =>
						async ({ result, update }) => {
							dialog.close();
							await update(); // shows the banner (with Undo) and refreshes the counts
							if (result.type === 'success') ondeleted(contact.id);
						}}
				>
					<input type="hidden" name="id" value={contact.id} />
					<button class="btn btn-error">Delete</button>
				</form>
			</div>
		</div>
		<!-- Clicking beside the dialog closes it (mouse/touch only; keyboard users have Esc and the visible button). -->
		<form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-hidden="true">Close</button></form>
	</dialog>

	<ContactDetailsDialog bind:this={detailsDialog} {contact} />
</li>
