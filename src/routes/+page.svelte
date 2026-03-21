<script>
	import {
		selectedModel,
		selectedStatementId,
		selectedDimensionFilter,
		statementsViz,
		setSelectedModel,
		setSelectedStatementId,
		setDimensionFilter
	} from '$lib/stores/universalState.js';
	import { ROW_ITEM_HEIGHT } from '$lib/viz/dimensionChartLayout.js';
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import ModelPills from '$lib/ui/ModelPills.svelte';
	import ContextPanel from '$lib/ui/ContextPanel.svelte';

	let chartWidth = $state(0);

	/**
	 * @param {{ text?: string, left?: string, right?: string, item_id: string, dimensionId?: number }} item
	 */
	function statementLabel(item) {
		if (item?.text) return item.text;
		if (item?.left && item?.right) {
			if (item.dimensionId === 27 && item.reverse === true) return `${item.right} vs. ${item.left}`;
			return `${item.left} vs. ${item.right}`;
		}
		return item?.item_id ?? '';
	}

</script>

<svelte:head>
	<title>Ethical AI — One Year Later</title>
</svelte:head>

<div class="min-h-screen bg-slate-100 text-slate-900">
	<div class="">
		{#if $statementsViz}
			{@const n = $statementsViz.dim.items.length}

			<div
				class="overflow-hidden rounded-lg bg-white ring-1 ring-slate-300 flex flex-col h-[calc(100vh)]"
			>
				<div
					class="grid"
					style:display="grid"
					style:grid-template-columns="minmax(240px, 320px) minmax(280px, 1fr) minmax(220px, 300px)"
					style:column-gap="0"
					style:row-gap="0"
				>
					<div class="bg-white px-4 py-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Statements</div>
							{#if $selectedDimensionFilter !== null}
								<button
									type="button"
									class="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
									onclick={() => setDimensionFilter(null)}
								>
									All dimensions
								</button>
							{/if}
						</div>
					</div>

					<div class="bg-[#ebebeb] px-3 py-3">
						<div class="flex flex-col items-center justify-center gap-2">
							<div class="text-xs font-semibold uppercase tracking-widest text-slate-500">Models</div>
							<ModelPills
								models={$statementsViz.modelSeries.map((m) => m.fundModel)}
								selected={$selectedModel}
								onSelect={setSelectedModel}
							/>
						</div>
					</div>

					<div class="bg-white px-4 py-3">
						<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Context</div>
					</div>
				</div>

				<div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
					<div
						class="grid bg-white"
						style:display="grid"
						style:grid-template-columns="minmax(240px, 320px) minmax(280px, 1fr) minmax(220px, 300px)"
						style:column-gap="0"
						style:row-gap="0"
						style:grid-template-rows={`repeat(${n}, ${ROW_ITEM_HEIGHT}px)`}
					>
						<div
							class="viz-table-cell box-border flex min-h-0 min-w-0 flex-col border-x border-slate-300 bg-[#ebebeb] px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.05)]"
							style="grid-column: 2; grid-row: 1 / span {n};"
						>
							<div
								bind:clientWidth={chartWidth}
								class="flex h-full min-h-0 w-full flex-1 items-stretch"
							>
								<DimensionAggregateBumpChart
									width={Math.max(chartWidth, 280)}
									viz={$statementsViz}
									selectedModel={$selectedModel}
								/>
							</div>
						</div>

						{#each $statementsViz.dim.items as item, i (item.item_id)}
							<div
								class="box-border flex items-center border-b border-slate-300 bg-white"
								style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 1; grid-row: {1 + i};"
							>
								<div
									class="flex h-full min-h-0 w-full min-w-0 items-start gap-2 rounded-md border py-2.5 pl-4 pr-3 transition-colors sm:py-3 {$selectedStatementId === item.item_id
										? 'border-slate-900 bg-slate-50'
										: 'border-transparent bg-transparent'}"
								>
									<button
										type="button"
										class="min-w-0 flex-1 text-left text-xs leading-snug text-slate-800 hover:opacity-90 sm:text-sm"
										onclick={() => setSelectedStatementId(item.item_id)}
									>
										<span class="line-clamp-2">{statementLabel(item)}</span>
									</button>
									<button
										type="button"
										class="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-left text-[10px] font-medium text-slate-700 hover:bg-slate-300"
										onclick={() => setDimensionFilter(item.dimensionId)}
									>
										{item.dimensionTitle}
									</button>
								</div>
							</div>

							<div
								class="box-border flex items-center border-b border-slate-300 bg-white"
								style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 3; grid-row: {1 + i};"
							>
								<ContextPanel showStatement={$selectedStatementId === item.item_id} />
							</div>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data.</p>
		{/if}
	</div>
</div>
