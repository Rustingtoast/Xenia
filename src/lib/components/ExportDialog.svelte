<script lang="ts">
	// Export the phone book. PLACEHOLDER: shows the choices; the export itself comes later.
	// A web page can't choose a folder: the file is downloaded (or, in Chrome/Edge, via "Save as").
	import { EXPORT_FORMAT_LABELS, ExportFormat } from '#lib/export.js';
	import { t } from '#lib/i18n/t.js';

	let dialog: HTMLDialogElement;
	let format = $state<ExportFormat>(ExportFormat.Excel);

	export function open() {
		dialog.showModal();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="export-title">
	<div class="modal-box">
		<h3 id="export-title" class="text-lg font-bold">{t('export.title')}</h3>
		<p class="mt-1 text-sm text-base-content/60">{t('export.intro')}</p>

		<fieldset class="fieldset mt-4">
			<legend class="fieldset-legend">{t('export.format')}</legend>
			{#each Object.values(ExportFormat) as option (option)}
				<label class="flex cursor-pointer items-center gap-3 py-1">
					<input type="radio" name="export-format" class="radio radio-sm" value={option} bind:group={format} />
					<span>{EXPORT_FORMAT_LABELS[option]}</span>
				</label>
			{/each}
		</fieldset>

		<fieldset class="fieldset mt-2">
			<legend class="fieldset-legend">{t('export.saveTo')}</legend>
			<div class="join w-full">
				<input type="text" class="input join-item w-full" value={t('export.downloads')} readonly aria-label={t('export.saveLocation')} />
				<button type="button" class="btn join-item" disabled title={t('common.comingSoon')}>{t('export.choose')}</button>
			</div>
			<p class="label">{t('export.chooseLater')}</p>
		</fieldset>

		<div role="note" class="mt-4 alert alert-soft alert-info text-sm">{t('export.notAvailable')}</div>

		<div class="modal-action">
			<form method="dialog"><button class="btn">{t('common.close')}</button></form>
			<button type="button" class="btn btn-primary" disabled>{t('export.submit', { format: EXPORT_FORMAT_LABELS[format] })}</button>
		</div>
	</div>
	<!-- Clicking beside the dialog closes it (mouse/touch only; keyboard users have Esc and the visible button). -->
	<form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-hidden="true">{t('common.close')}</button></form>
</dialog>
