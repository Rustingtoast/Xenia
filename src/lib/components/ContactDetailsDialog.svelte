<script lang="ts">
	// All fields from ContactField, so a new field shows up here automatically.
	import { tick } from 'svelte';
	import { CONTACT_FIELD_LABELS, ContactField, contactFieldText } from '#lib/contact-fields.js';
	import type { Contact } from '#lib/contacts.js';
	import Highlight from './Highlight.svelte';

	// `search`: the list's current search; its matches are highlighted here too.
	let { contact, search = '' }: { contact: Contact; search?: string } = $props();

	let dialog: HTMLDialogElement;
	// Every row has its own dialog and most are never opened: the content is only rendered once it is.
	let opened = $state(false);

	export async function open() {
		opened = true;
		await tick(); // the content must be there first: the dialog focuses its Close button when it opens
		dialog.showModal();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="contact_{contact.id}_details_title">
	{#if opened}
		<div class="modal-box">
			<h3 id="contact_{contact.id}_details_title" class="text-lg font-bold">Contact details</h3>

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
