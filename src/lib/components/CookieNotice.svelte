<script lang="ts">
	// Bottom banner telling what the cookies are for (purely functional: sign-in, language, this notice).
	// One click on OK hides it for a year; until then it doesn't block anything. The server decides whether
	// to render it (routes/+layout.server.ts), so a dismissed notice never flashes on page load.
	import { COOKIE_NOTICE_COOKIE, COOKIE_NOTICE_MAX_AGE } from '#lib/cookie-notice.js';
	import { t } from '#lib/i18n/t.js';

	let { show }: { show: boolean } = $props();

	let dismissed = $state(false);

	function dismiss() {
		document.cookie = `${COOKIE_NOTICE_COOKIE}=dismissed; path=/; max-age=${COOKIE_NOTICE_MAX_AGE}; samesite=lax`;
		dismissed = true;
	}
</script>

{#if show && !dismissed}
	<!-- z-50: above the top bar and the Group list; dialogs still open above it (top layer). -->
	<section aria-labelledby="cookie-notice-title" class="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
		<div
			class="mx-auto flex max-w-3xl flex-col gap-3 rounded-box bg-base-100 p-4 shadow-xl ring-1 ring-base-content/10 sm:flex-row sm:items-center sm:gap-4"
		>
			<div class="flex-1">
				<h2 id="cookie-notice-title" class="font-semibold">{t('cookies.title')}</h2>
				<p class="mt-1 text-sm text-base-content/70">{t('cookies.notice')}</p>
			</div>
			<button type="button" class="btn shrink-0 btn-primary sm:btn-sm" onclick={dismiss}>{t('cookies.dismiss')}</button>
		</div>
	</section>
{/if}
