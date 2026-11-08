<script lang="ts">
	// All of a contact's information in one view. The fields come from ContactField (contact-fields.ts),
	// so a new field shows up here by adding it there.
	import { CONTACT_FIELD_LABELS, ContactField, contactFieldText } from '#lib/contact-fields.js';
	import type { Contact } from '#lib/contacts.js';

	let { contact }: { contact: Contact } = $props();

	let dialog: HTMLDialogElement;

	export function open() {
		dialog.showModal();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="contact_{contact.id}_details_title">
	<div class="modal-box">
		<h3 id="contact_{contact.id}_details_title" class="text-lg font-bold">Contact details</h3>

		<dl class="mt-4 divide-y divide-base-content/10">
			{#each Object.values(ContactField) as field (field)}
				<div class="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
					<dt class="text-sm text-base-content/60">{CONTACT_FIELD_LABELS[field]}</dt>
					<dd class="min-w-0 break-words" data-field={field}>
						{#if field === ContactField.PhoneNumber}
							<span class="text-lg font-semibold tabular-nums">{contact.phoneNumber}</span>
						{:else if field === ContactField.Group}
							<span class="badge badge-soft badge-primary">{contact.groupName}</span>
						{:else if field === ContactField.Description && !contact.description}
							<span class="text-base-content/40 italic">No description</span>
						{:else}
							<!-- pre-wrap keeps line breaks (descriptions can have several lines). -->
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
</dialog>
