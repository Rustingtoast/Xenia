<script lang="ts">
	// Shown inside the root layout for unknown pages and server errors, in the page's language.
	import { page } from '$app/state';
	import { t } from '#lib/i18n/t.js';
</script>

<svelte:head>
	<title>{page.status} · Xenia</title>
</svelte:head>

<div class="mx-auto mt-16 max-w-sm rounded-box bg-base-100 p-6 text-center shadow-sm">
	<h1 class="text-4xl font-bold text-base-content/40">{page.status}</h1>
	<p class="mt-2">{page.status === 404 ? t('error.notFound') : t('error.generic')}</p>
	<a href="/" class="btn mt-6 btn-primary">{t('error.backHome')}</a>
</div>
