<script>
	import { MODEL_ORDER } from '$lib/viz/modelColors.js';

	/** @type {{ models: string[], selected: string, onSelect: (m: string) => void }} */
	let { models, selected, onSelect } = $props();
</script>

<div class="flex flex-wrap items-center justify-center gap-2">
	<span class="sr-only">Models</span>
	{#each MODEL_ORDER.filter((m) => models.includes(m)) as m (m)}
		<button
			type="button"
			class={selected === m
				? 'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors border-slate-900 ring-2 ring-slate-900 bg-slate-900 text-white'
				: 'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors border-slate-300 bg-white text-slate-700'}
			onclick={() => onSelect(m)}
		>
			{m}
		</button>
	{/each}
</div>
