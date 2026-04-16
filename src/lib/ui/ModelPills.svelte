<script>
	import { MODEL_ORDER, modelColor } from '$lib/viz/modelColors.js';

	/** @type {{ models: string[], selected: (string|null), onSelect: (m: (string|null)) => void }} */
	let { models, selected, onSelect } = $props();

	const visibleModels = $derived(MODEL_ORDER.filter((m) => models.includes(m)));

	/** All first, then each model — same pill treatment, flows in a 3-column grid (two rows when there are six). */
	const pills = $derived(
		/** @type {{ id: string, model: string | null, label: string }[]} */ ([
			{ id: '__all__', model: null, label: 'All' },
			...visibleModels.map((m) => ({ id: m, model: m, label: m }))
		])
	);

	/** Matches dimension / statement tray cards: light surface, ring when selected. */
	const basePill =
		'flex min-h-0 w-full min-w-0 items-center justify-start gap-2 rounded-md border px-3 py-2.5 text-left text-sm leading-snug shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';
	const selectedPill = 'border-slate-900 bg-slate-50 ring-2 ring-slate-400';
	const idlePill = 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50';
</script>

<div class="w-full min-w-0">
	<span class="sr-only">Models</span>
	<div class="grid w-full min-w-0 grid-cols-3 gap-2">
		{#each pills as pill (pill.id)}
			{@const isSelected = pill.model === null ? selected === null : selected === pill.model}
			<button
				type="button"
				class="{basePill} {isSelected ? selectedPill : idlePill}"
				onclick={() => onSelect(pill.model)}
			>
				{#if pill.model === null}
					<span
						class="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 bg-slate-400"
						aria-hidden="true"
					></span>
				{:else}
					<span
						class="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-900/20 ring-1 ring-black/10"
						style:background-color={modelColor(pill.model)}
						aria-hidden="true"
					></span>
				{/if}
				<span
					class="min-w-0 truncate text-slate-900 {isSelected ? 'font-semibold' : 'font-normal'}"
					>{pill.label}</span>
			</button>
		{/each}
	</div>
</div>
