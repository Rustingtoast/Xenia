<script lang="ts">
	import LanguageSelect from '#lib/components/LanguageSelect.svelte';
	import { t } from '#lib/i18n/t.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('login.pageTitle')} · Xenia</title>
</svelte:head>

<div class="mx-auto mt-16 max-w-sm">
	<div class="rounded-box bg-base-100 p-6 shadow-sm">
		<h1 class="text-xl font-bold">{t('login.heading')}</h1>

		<form method="POST" class="mt-4 flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<label for="email" class="text-sm font-medium">{t('auth.email')}</label>
				<input id="email" name="email" type="text" inputmode="email" class="input w-full" autocomplete="username" required />
			</div>
			<div class="flex flex-col gap-1">
				<label for="password" class="text-sm font-medium">{t('auth.password')}</label>
				<input id="password" name="password" type="password" class="input w-full" autocomplete="current-password" required />
			</div>
			{#if form?.error}<p class="text-sm text-error" role="alert">{t(form.error)}</p>{/if}
			<button type="submit" class="btn btn-primary">{t('login.submit')}</button>
		</form>

		<p class="mt-4 text-sm text-base-content/60">
			{t('login.noAccount')} <a href="/register" class="link link-primary">{t('login.registerLink')}</a>
		</p>
	</div>

	<div class="mt-4 flex items-center justify-center gap-2">
		<label for="login-language" class="text-sm text-base-content/60">{t('settings.language')}</label>
		<LanguageSelect id="login-language" class="w-44 select-sm" />
	</div>
</div>
