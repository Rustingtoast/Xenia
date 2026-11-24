<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Log in · Xenia</title>
</svelte:head>

<div class="mx-auto mt-16 max-w-sm">
	<div class="rounded-box bg-base-100 p-6 shadow-sm">
		<h1 class="text-xl font-bold">Log in to Xenia</h1>

		<form method="POST" class="mt-4 flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<label for="email" class="text-sm font-medium">Email</label>
				<input id="email" name="email" type="text" inputmode="email" class="input w-full" autocomplete="username" required />
			</div>
			<div class="flex flex-col gap-1">
				<label for="password" class="text-sm font-medium">Password</label>
				<input id="password" name="password" type="password" class="input w-full" autocomplete="current-password" required />
			</div>
			{#if form?.error}<p class="text-sm text-error" role="alert">{form.error}</p>{/if}
			<button type="submit" class="btn btn-primary">Log in</button>
		</form>

		<p class="mt-4 text-sm text-base-content/60">No account? <a href="/register" class="link link-primary">Register</a></p>
	</div>
</div>
