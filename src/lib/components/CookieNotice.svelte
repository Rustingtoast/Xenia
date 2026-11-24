<script lang="ts">
	// Bottom banner telling what the cookies are for (purely functional: sign-in, language, this notice).
	// One click on OK hides it for a year. Until then it covers nothing that matters: the page keeps room
	// below for it, and the Group list drawer and row menus open above it. The server decides whether to
	// render it (routes/+layout.server.ts), so a dismissed notice never flashes on page load.
	import { COOKIE_NOTICE_COOKIE, COOKIE_NOTICE_MAX_AGE } from '#lib/cookie-notice.js';
	import { t } from '#lib/i18n/t.js';

	let { show }: { show: boolean } = $props();

	let dismissed = $state(false);
	/** The notice's height: the room the page keeps below its content. */
	let height = $state(0);

	function dismiss() {
		document.cookie = `${COOKIE_NOTICE_COOKIE}=dismissed; path=/; max-age=${COOKIE_NOTICE_MAX_AGE}; samesite=lax`;
		dismissed = true;
	}
</script>

{#if show && !dismissed}
	<!-- Room below the page, so its last rows can scroll up above the notice. -->
	<div aria-hidden="true" style:height="{height}px"></div>
	<!-- z-25: above the page and the sticky bars (z-20); below the drawer's backdrop (30), the drawer (40), row
	     menus (30/40). Dialogs open above everything anyway (top layer). -->
	<section
		bind:offsetHeight={height}
		aria-labelledby="cookie-notice-title"
		class="fixed inset-x-0 bottom-0 z-25 p-3 sm:p-4"
	>
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
