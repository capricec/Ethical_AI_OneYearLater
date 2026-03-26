<script>
	import { tick } from 'svelte';

	/** @type {{ key: string, label: string, description?: string }[]} */
	let { subscales, focusedKey = null } = $props();

	$effect(() => {
		if (!focusedKey) return;
		const run = async () => {
			await tick();
			const row = document.querySelector(`[data-subscale-key="${focusedKey}"]`);
			if (!row) return;
			row.scrollIntoView({ behavior: 'smooth', block: 'center' });
		};
		run();
	});
</script>

<ul class="list-none space-y-3 p-3 text-slate-800">
	{#each subscales as s (s.key)}
		<li
			data-subscale-key={s.key}
			class="rounded-md border bg-white px-3 py-2.5 shadow-sm transition-colors {focusedKey === s.key
				? 'border-slate-500 bg-slate-50 ring-2 ring-slate-300'
				: 'border-slate-200'}"
		>
			<div class="text-sm font-semibold leading-snug text-slate-900">{s.label}</div>
			{#if s.description}
				<p class="mt-2 text-xs leading-relaxed text-slate-600">{s.description}</p>
			{/if}
		</li>
	{/each}
</ul>
