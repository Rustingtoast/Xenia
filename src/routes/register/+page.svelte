<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Register · Xenia</title>
</svelte:head>

<div class="mx-auto mt-16 max-w-sm">
	<div class="rounded-box bg-base-100 p-6 shadow-sm">
		<h1 class="text-xl font-bold">Create your account</h1>
		<p class="mt-1 text-sm text-base-content/60">Each account has its own phone book.</p>

		<form method="POST" class="mt-4 flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<label for="email" class="text-sm font-medium">Email</label>
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
				{#if form?.errors?.email}<p class="text-sm text-error">{form.errors.email}</p>{/if}
			</div>
			<div class="flex flex-col gap-1">
				<label for="password" class="text-sm font-medium">Password</label>
				<input id="password" name="password" type="password" class="input w-full" autocomplete="new-password" minlength="8" required />
				{#if form?.errors?.password}<p class="text-sm text-error">{form.errors.password}</p>{/if}
			</div>
			<div class="flex flex-col gap-1">
				<label for="confirm" class="text-sm font-medium">Confirm password</label>
				<input id="confirm" name="confirm" type="password" class="input w-full" autocomplete="new-password" required />
				{#if form?.errors?.confirm}<p class="text-sm text-error">{form.errors.confirm}</p>{/if}
			</div>
			<button type="submit" class="btn btn-primary">Register</button>
		</form>

		<p class="mt-4 text-sm text-base-content/60">Already have an account? <a href="/login" class="link link-primary">Log in</a></p>
	</div>
</div>
