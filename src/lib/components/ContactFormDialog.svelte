<script lang="ts">
	// The create/edit contact dialog. Posts to the `create` or `update` action, shows validation
	// errors inline and, on success, asks the page to refresh the list around the contact.
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import type { Contact, ContactChange } from '#lib/contacts.js';
	import { pageAction } from '#lib/forms.js';
	import type { ContactInput, ValidationErrors } from '#lib/server/contacts.js';

	let {
		contact = null,
		onchanged
	}: { contact?: Contact | null; onchanged: (change: ContactChange) => void } = $props();

	let dialog: HTMLDialogElement;
	let opened = $state(false);
	let saving = $state(false);

	let groupName = $state('');
	let location = $state('');
	let phoneNumber = $state('');
	let description = $state('');
	let errors = $state<ValidationErrors>({});

	// Every field id is unique per dialog, so the create dialog and each row's edit dialog never collide.
	const idPrefix = $derived(contact ? `edit-${contact.id}` : 'new-contact');

	export async function open() {
		groupName = contact?.groupName ?? '';
		location = contact?.location ?? '';
		phoneNumber = contact?.phoneNumber ?? '';
		description = contact?.description ?? '';
		errors = {};
		opened = true;
		await tick(); // the form must be there first: showModal() focuses the first input
		dialog.showModal();
	}

	function messages(field: keyof ContactInput): string[] {
		return errors[field] ?? [];
	}
</script>

<dialog
	bind:this={dialog}
	class="modal modal-bottom sm:modal-middle"
	aria-labelledby={contact ? `${idPrefix}-title` : 'new-contact-title'}
>
	{#if opened}
		<form
			method="POST"
			action={pageAction(page.url, contact ? 'update' : 'create')}
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'failure') {
						// Keep the dialog open and show what was wrong; the fields keep what was typed.
						errors = (result.data?.errors as ValidationErrors | undefined) ?? {};
						return;
					}
					if (result.type !== 'success') return; // redirect/error: nothing to refresh
					const change = result.data?.change as ContactChange | undefined;
					dialog.close();
					await update({ navigate: false }); // refresh groups/counts, keep the search
					if (change) onchanged(change);
				};
			}}
			class="modal-box"
		>
			{#if contact}
				<input type="hidden" name="id" value={contact.id} />
			{/if}
			<h3 id={contact ? `${idPrefix}-title` : 'new-contact-title'} class="text-lg font-bold">
				{contact ? 'Edit contact' : 'New contact'}
			</h3>

			<div class="mt-4 flex flex-col gap-4">
				<div class="flex flex-col gap-1">
					<label for={`${idPrefix}-group`} class="text-sm font-medium">Group</label>
					<input
						id={`${idPrefix}-group`}
						name="groupName"
						type="text"
						class="input w-full"
						bind:value={groupName}
						maxlength="100"
						placeholder="e.g. Family"
						aria-invalid={messages('groupName').length > 0}
					/>
					{#each messages('groupName') as message}<p class="text-sm text-error">{message}</p>{/each}
				</div>

				<div class="flex flex-col gap-1">
					<label for={`${idPrefix}-location`} class="text-sm font-medium">Location</label>
					<input
						id={`${idPrefix}-location`}
						name="location"
						type="text"
						class="input w-full"
						bind:value={location}
						maxlength="100"
						placeholder="e.g. Zurich"
						aria-invalid={messages('location').length > 0}
					/>
					{#each messages('location') as message}<p class="text-sm text-error">{message}</p>{/each}
				</div>

				<div class="flex flex-col gap-1">
					<label for={`${idPrefix}-phone`} class="text-sm font-medium">Phone number</label>
					<input
						id={`${idPrefix}-phone`}
						name="phoneNumber"
						type="tel"
						class="input w-full"
						bind:value={phoneNumber}
						maxlength="30"
						placeholder="e.g. +41 79 123 45 67"
						aria-invalid={messages('phoneNumber').length > 0}
					/>
					{#each messages('phoneNumber') as message}<p class="text-sm text-error">{message}</p>{/each}
				</div>

				<div class="flex flex-col gap-1">
					<label for={`${idPrefix}-description`} class="text-sm font-medium">Description</label>
					<textarea
						id={`${idPrefix}-description`}
						name="description"
						class="textarea w-full"
						bind:value={description}
						maxlength="1000"
						placeholder="Optional"
						aria-invalid={messages('description').length > 0}
					></textarea>
					{#each messages('description') as message}<p class="text-sm text-error">{message}</p>{/each}
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>{contact ? 'Save' : 'Add'}</button>
			</div>
		</form>
		<!-- Clicking beside the dialog closes it (mouse/touch only; keyboard users have Esc and the visible button). -->
		<form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-hidden="true">Close</button></form>
	{/if}
</dialog>
