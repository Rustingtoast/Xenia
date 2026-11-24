<script lang="ts">
	// App settings: the language. Dark mode is still a placeholder here (the sun/moon button in the top bar
	// works already).
	import { t } from '#lib/i18n/t.js';
	import LanguageSelect from './LanguageSelect.svelte';

	let dialog: HTMLDialogElement;

	export function open() {
		dialog.showModal();
	}
</script>

<dialog bind:this={dialog} class="modal modal-bottom sm:modal-middle" aria-labelledby="settings-title">
	<div class="modal-box">
		<h3 id="settings-title" class="text-lg font-bold">{t('settings.title')}</h3>

		<ul class="mt-4 divide-y divide-base-content/10">
			<li class="flex items-center justify-between gap-4 py-3">
				<label for="settings-language" class="font-medium">{t('settings.language')}</label>
				<LanguageSelect id="settings-language" class="w-44 shrink-0" />
			</li>
			<li class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="font-medium">{t('settings.darkMode')}</p>
					<p class="text-sm text-base-content/60">{t('settings.darkModeHint')}</p>
				</div>
				<span class="badge shrink-0 badge-ghost">{t('common.comingSoon')}</span>
			</li>
		</ul>

		<div class="modal-action">
			<form method="dialog"><button class="btn">{t('common.close')}</button></form>
		</div>
	</div>
	<!-- Clicking beside the dialog closes it (mouse/touch only; keyboard users have Esc and the visible button). -->
	<form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-hidden="true">{t('common.close')}</button></form>
</dialog>
