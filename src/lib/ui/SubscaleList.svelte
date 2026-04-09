<script>
	import { tick } from 'svelte';

	/** @type {{ key: string, label: string, description?: string }[]} */
	let { subscales, focusedKey = null, selectedKey = null, onSelect } = $props();

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
		<li class="list-none">
			<button
				type="button"
				data-subscale-key={s.key}
				class="w-full rounded-md border px-3 py-2.5 text-left shadow-sm transition-[opacity,colors] {selectedKey &&
				selectedKey !== s.key
					? 'opacity-20'
					: ''} {selectedKey === s.key
					? 'border-slate-900 bg-slate-50 ring-2 ring-slate-400'
					: focusedKey === s.key
						? 'border-slate-500 bg-slate-50 ring-2 ring-slate-300'
						: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'}"
				onclick={() => onSelect?.(s.key)}
			>
				<div class="text-sm font-semibold leading-snug text-slate-900">{s.label}</div>
				{#if s.description}
					<p class="mt-2 text-xs leading-relaxed text-slate-600">{s.description}</p>
				{/if}
			</button>
		</li>
	{/each}
</ul>
