<script>
	import IdeologyCard from '$lib/components/IdeologyCard.svelte';
	import IdeologyModelPills from '$lib/components/IdeologyModelPills.svelte';
	import { modelColor } from '$lib/viz/modelColors.js';

	/** @type {{
		models: string[],
		selectedModel: string,
		rankings: import('$lib/data/archetypeSimilarity.js').ArchetypeRankingRow[],
		onSelectModel?: (model: string) => void,
		onOpenBuilder?: () => void,
		onRemoveCustom?: () => void
	}} */
	let { models = [], selectedModel = '', rankings = [], onSelectModel, onOpenBuilder, onRemoveCustom } =
		$props();

	const bubbleColor = $derived(modelColor(selectedModel));
</script>

<div class="flex flex-col bg-slate-100 md:h-full md:min-h-0">
	<div class="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-4 md:px-5 md:pt-5">
		<h2 class="text-base font-bold text-slate-900 md:text-lg">Ideologic Profiles</h2>
		<p class="mt-1 text-xs text-slate-600 md:text-sm">
			How closely each ideology matches {selectedModel || 'the selected model'}&rsquo;s average survey
			responses.
		</p>
		<div class="mt-4">
			<IdeologyModelPills {models} {selectedModel} onSelect={onSelectModel} />
		</div>
	</div>

	<div class="px-4 py-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-5">
		<ul class="space-y-3">
			{#each rankings as row (row.id)}
				<li>
					<IdeologyCard
						title={row.title}
						description={row.description}
						similarityPct={row.similarityPct}
						{bubbleColor}
						isCustom={row.isCustom}
						onRemove={row.isCustom ? onRemoveCustom : undefined}
					/>
				</li>
			{/each}
		</ul>
	</div>

	<div class="shrink-0 border-t border-slate-200 bg-white px-4 py-4 md:px-5">
		<button
			type="button"
			class="w-full rounded-full bg-[#4B4B4E] px-4 py-3 text-center text-xs font-semibold leading-snug text-white transition-colors hover:bg-[#434346] md:text-sm"
			onclick={() => onOpenBuilder?.()}
		>
			Don&rsquo;t like these ideologies? Make your own.
		</button>
	</div>
</div>
