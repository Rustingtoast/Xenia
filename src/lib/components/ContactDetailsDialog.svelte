<script lang="ts">
	// All fields from ContactField, so a new field shows up here automatically.
	import { tick } from 'svelte';
	import { CONTACT_FIELD_LABELS, ContactField, contactFieldText } from '#lib/contact-fields.js';
	import type { Contact } from '#lib/contacts.js';
	import Highlight from './Highlight.svelte';

	// `search`: the list's current search; its matches are highlighted here too.
	let {
		contact,
		search = '',
		onedit
	}: { contact: Contact; search?: string; onedit: () => void } = $props();

	let dialog: HTMLDialogElement;
	// Every row has its own dialog and most are never opened: the content is only rendered once it is.
	let opened = $state(false);

	export async function open() {
		opened = true;
		await tick(); // the content must be there first: the dialog focuses its Close button when it opens
		dialog.showModal();
	}

	/** Closes the dialog (the "Edit" button switches to the edit dialog instead). */
	export function close() {
		dialog.close();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="contact_{contact.id}_details_title">
	{#if opened}
		<div class="modal-box">
			<div class="flex items-center justify-between gap-2">
				<h3 id="contact_{contact.id}_details_title" class="text-lg font-bold">Contact details</h3>
				<button
					type="button"
					class="btn btn-square btn-ghost btn-sm"
					aria-label="Edit {contact.phoneNumber}"
					title="Edit contact"
					onclick={onedit}
				>
					<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
					</svg>
				</button>
			</div>

			<dl class="mt-4 divide-y divide-base-content/10">
				{#each Object.values(ContactField) as field (field)}
					<div class="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
						<dt class="text-sm text-base-content/60">{CONTACT_FIELD_LABELS[field]}</dt>
						<dd class="min-w-0 break-words" data-field={field}>
							{#if field === ContactField.PhoneNumber}
								<span class="text-lg font-semibold tabular-nums"><Highlight text={contact.phoneNumber} {search} phoneNumber /></span>
							{:else if field === ContactField.Group}
								<span class="badge badge-soft badge-primary"><Highlight text={contact.groupName} {search} /></span>
							{:else if field === ContactField.Description && !contact.description}
								<span class="text-base-content/40 italic">No description</span>
							{:else if field === ContactField.Location || field === ContactField.Description}
								<!-- pre-wrap keeps line breaks in descriptions. -->
								<span class="whitespace-pre-wrap"><Highlight text={contactFieldText(contact, field)} {search} /></span>
							{:else}
								<span class="whitespace-pre-wrap">{contactFieldText(contact, field)}</span>
							{/if}
						</dd>
					</div>
				{/each}
			</dl>

			<div class="modal-action">
				<!-- autofocus: the dialog opens with focus on Close (MDN's advice for dialogs), not on the number. -->
				<!-- svelte-ignore a11y_autofocus -->
				<form method="dialog"><button class="btn" autofocus>Close</button></form>
			</div>
		</div>
		<!-- Clicking beside the dialog closes it (mouse/touch only; keyboard users have Esc and the visible button). -->
		<form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-hidden="true">Close</button></form>
	{/if}
</dialog>
