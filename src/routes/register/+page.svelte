<script lang="ts">
	import LanguageSelect from '#lib/components/LanguageSelect.svelte';
	import { t } from '#lib/i18n/t.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('register.pageTitle')} · Xenia</title>
</svelte:head>

<div class="mx-auto mt-16 max-w-sm">
	<div class="rounded-box bg-base-100 p-6 shadow-sm">
		<h1 class="text-xl font-bold">{t('register.heading')}</h1>
		<p class="mt-1 text-sm text-base-content/60">{t('register.intro')}</p>

		<form method="POST" class="mt-4 flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<label for="email" class="text-sm font-medium">{t('auth.email')}</label>
				<input
					id="email"
					name="email"
					type="text"
					inputmode="email"
					class="input w-full"
					autocomplete="username"
					value={form?.email ?? ''}
					required
				/>
				{#if form?.errors?.email}<p class="text-sm text-error">{t(form.errors.email)}</p>{/if}
			</div>
			<div class="flex flex-col gap-1">
				<label for="password" class="text-sm font-medium">{t('auth.password')}</label>
				<input id="password" name="password" type="password" class="input w-full" autocomplete="new-password" minlength="8" required />
				{#if form?.errors?.password}<p class="text-sm text-error">{t(form.errors.password)}</p>{/if}
			</div>
			<div class="flex flex-col gap-1">
				<label for="confirm" class="text-sm font-medium">{t('register.confirmPassword')}</label>
				<input id="confirm" name="confirm" type="password" class="input w-full" autocomplete="new-password" required />
				{#if form?.errors?.confirm}<p class="text-sm text-error">{t(form.errors.confirm)}</p>{/if}
			</div>
			<button type="submit" class="btn btn-primary">{t('register.submit')}</button>
		</form>

		<p class="mt-4 text-sm text-base-content/60">
			{t('register.haveAccount')} <a href="/login" class="link link-primary">{t('register.loginLink')}</a>
		</p>
	</div>

	<div class="mt-4 flex items-center justify-center gap-2">
		<label for="register-language" class="text-sm text-base-content/60">{t('settings.language')}</label>
		<LanguageSelect id="register-language" class="w-44 select-sm" />
	</div>
</div>
