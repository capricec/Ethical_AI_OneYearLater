<script>
	import {
		selectedModel,
		selectedStatementId,
		selectedDimensionFilter,
		selectedViewMode,
		statementsViz,
		setSelectedModel,
		setSelectedStatementId,
		setDimensionFilter,
		setSelectedViewMode,
		VIEW_MODE_DIMENSION_BUMP,
		VIEW_MODE_RADIAL
	} from '$lib/stores/universalState.js';
	import { ROW_ITEM_HEIGHT } from '$lib/viz/dimensionChartLayout.js';
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import StatementsRadialChart from '$lib/viz/StatementsRadialChart.svelte';
	import ModelPills from '$lib/ui/ModelPills.svelte';
	import ContextPanel from '$lib/ui/ContextPanel.svelte';
	import SubscaleList from '$lib/ui/SubscaleList.svelte';
	import { statementLabel } from '$lib/ui/statementLabel.js';

	/** Fixed context rail; revisit breakpoints for small screens. */
	const CONTEXT_RAIL_PX = 280;

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
</script>

<svelte:head>
	<title>Ethical AI — One Year Later</title>
</svelte:head>

<div class="min-h-screen bg-slate-100 text-slate-900">
	<div class="">
		{#if $statementsViz}
			{@const n = $statementsViz.dim.items.length}
			{@const isBump = $selectedViewMode === VIEW_MODE_DIMENSION_BUMP}
			{@const radialSquare = Math.max(
				260,
				Math.floor(
					Math.min(Math.max(radialCellW, 1) - 16, Math.max(radialCellH, 1) - 16)
				)
			)}
			{@const subscaleRail = $statementsViz.subscalesInOrder ?? []}
			{@const mainGridCols =
				`minmax(240px, 320px) minmax(280px, 1fr) ${CONTEXT_RAIL_PX}px`}

			<div
				class="flex h-[calc(100vh)] min-h-0 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-300"
			>
				<!-- Same 3-column header in both views so View / Models stay put -->
				<div
					class="grid shrink-0"
					style:display="grid"
					style:grid-template-columns={mainGridCols}
					style:column-gap="0"
					style:row-gap="0"
				>
					<div class="bg-white px-4 py-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							{#if isBump}
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Statements
								</div>
							{:else}
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-400">
									Statements
								</div>
							{/if}
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
							<div class="flex flex-wrap items-center justify-center gap-1">
								<span class="text-xs font-semibold uppercase tracking-widest text-slate-500"
									>View</span
								>
								<div
									class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-[10px] font-semibold"
								>
									<button
										type="button"
										class="rounded px-2 py-1 transition-colors {$selectedViewMode ===
										VIEW_MODE_DIMENSION_BUMP
											? 'bg-slate-800 text-white'
											: 'text-slate-600 hover:bg-slate-100'}"
										onclick={() => setSelectedViewMode(VIEW_MODE_DIMENSION_BUMP)}
									>
										Bump
									</button>
									<button
										type="button"
										class="rounded px-2 py-1 transition-colors {$selectedViewMode ===
										VIEW_MODE_RADIAL
											? 'bg-slate-800 text-white'
											: 'text-slate-600 hover:bg-slate-100'}"
										onclick={() => setSelectedViewMode(VIEW_MODE_RADIAL)}
									>
										Radial
									</button>
								</div>
							</div>
							<div class="text-xs font-semibold uppercase tracking-widest text-slate-500">
								Models
							</div>
							<ModelPills
								models={$statementsViz.modelSeries.map((m) => m.fundModel)}
								selected={$selectedModel}
								onSelect={setSelectedModel}
							/>
						</div>
					</div>

					<div class="flex items-center border-l border-slate-200 bg-white px-4 py-3">
						<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Context</div>
					</div>
				</div>

				{#if isBump}
					<div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
						<div
							class="grid bg-white"
							style:display="grid"
							style:grid-template-columns={mainGridCols}
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
									style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 1; grid-row: {1 +
										i};"
								>
									<div
										class="flex min-h-0 w-full min-w-0 items-start gap-2 rounded-md border py-2.5 pl-4 pr-3 transition-colors sm:py-3 {$selectedStatementId ===
										item.item_id
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
									style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 3; grid-row: {1 +
										i};"
								>
									<ContextPanel showStatement={$selectedStatementId === item.item_id} />
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div
						class="grid min-h-0 flex-1 overflow-hidden"
						style:display="grid"
						style:grid-template-columns={mainGridCols}
						style:column-gap="0"
						style:row-gap="0"
					>
						<div class="min-h-0 bg-white" aria-hidden="true"></div>
						<div
							class="box-border flex min-h-0 min-w-0 flex-col overflow-hidden border-x border-slate-300 bg-[#ebebeb] shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.05)]"
						>
							<div
								bind:clientWidth={radialCellW}
								bind:clientHeight={radialCellH}
								class="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-2"
							>
								<StatementsRadialChart
									width={radialSquare}
									height={radialSquare}
									viz={$statementsViz}
									selectedModel={$selectedModel}
								/>
							</div>
						</div>
						<aside class="min-h-0 overflow-y-auto border-l border-slate-200 bg-white">
							<SubscaleList subscales={subscaleRail} />
						</aside>
					</div>
				{/if}
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data.</p>
		{/if}
	</div>
</div>
