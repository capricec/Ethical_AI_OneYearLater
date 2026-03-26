<script>
	import { MODEL_ORDER, modelColor } from '$lib/viz/modelColors.js';

	/** @type {{ models: string[], selected: (string|null), onSelect: (m: (string|null)) => void }} */
	let { models, selected, onSelect } = $props();
</script>

<div class="flex flex-wrap items-center justify-center gap-2">
	<span class="sr-only">Models</span>
	<button
		type="button"
		class={selected === null
			? 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors border-slate-900 ring-2 ring-slate-900 bg-slate-900 text-white'
			: 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors border-slate-300 bg-white text-slate-700'}
		onclick={() => onSelect(null)}
	>
		<span
			class="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40 bg-slate-400"
			aria-hidden="true"
		></span>
		All
	</button>
	{#each MODEL_ORDER.filter((m) => models.includes(m)) as m (m)}
		{@const c = modelColor(m)}
		<button
			type="button"
			class={selected === m
				? 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors border-slate-900 ring-2 ring-slate-900 bg-slate-900 text-white'
				: 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors border-slate-300 bg-white text-slate-700'}
			onclick={() => onSelect(m)}
		>
			<span
				class="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-900/20 ring-1 ring-black/10"
				style:background-color={c}
				aria-hidden="true"
			></span>
			{m}
		</button>
	{/each}
</div>
