<script lang="ts">
	// App settings. PLACEHOLDER: lists what will live here; the controls come later.
	// (Dark mode already works through the sun/moon button in the top bar.)
	let dialog: HTMLDialogElement;

	export function open() {
		dialog.showModal();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="settings-title">
	<div class="modal-box">
		<h3 id="settings-title" class="text-lg font-bold">Settings</h3>

		<ul class="mt-4 divide-y divide-base-content/10">
			<li class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="font-medium">Dark mode</p>
					<p class="text-sm text-base-content/60">For now: the sun/moon button in the top bar.</p>
				</div>
				<span class="badge badge-ghost">Coming soon</span>
			</li>
			<li class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="font-medium">Language</p>
					<p class="text-sm text-base-content/60">English</p>
				</div>
				<span class="badge badge-ghost">Coming soon</span>
			</li>
		</ul>

		<div class="modal-action">
			<form method="dialog"><button class="btn">Close</button></form>
		</div>
	</div>
	<!-- Clicking beside the dialog closes it (mouse/touch only; keyboard users have Esc and the visible button). -->
	<form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-hidden="true">Close</button></form>
</dialog>
