<script>
	import { onMount } from 'svelte';
	import {
		selectedModel,
		selectedStatementId,
		selectedSubscaleFilter,
		selectedViewMode,
		statementsViz,
		setSelectedModel,
		setSelectedStatementId,
		setDimensionFilter,
		setSubscaleFilter,
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

	/** Fixed statements column when Bump tray is open. */
	const LEFT_TRAY_W = 360;
	/** Fixed context / subscale rail. */
	const CONTEXT_RAIL_PX = 280;

	/** Dimension pills removed for now; avoid a stuck dimension-only filter. */
	onMount(() => {
		setDimensionFilter(null);
	});

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
	let focusedSubscaleKey = $state(null);

	/** @param {string} subscaleKey */
	function handleRadialSubscaleClick(subscaleKey) {
		focusedSubscaleKey = subscaleKey;
	}
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
			{@const bumpMainCols = `minmax(280px, 1fr) ${CONTEXT_RAIL_PX}px`}

			<div
				class="flex h-[calc(100vh)] min-h-0 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-300"
			>
				<!-- Header: left tray | view+models | context label -->
				<div class="flex shrink-0 border-b border-slate-200">
					<div
						class="tray-slide shrink-0 overflow-hidden border-r border-slate-200 bg-white"
						style="width: {isBump ? LEFT_TRAY_W : 0}px;"
					>
						<div class="box-border flex h-full w-[360px] flex-col justify-center px-4 py-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div
									class="text-xs font-semibold uppercase tracking-wide {isBump
										? 'text-slate-500'
										: 'text-slate-400'}"
								>
									Statements
								</div>
								<div class="flex flex-wrap items-center justify-end gap-2">
									{#if $selectedSubscaleFilter !== null}
										<button
											type="button"
											class="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
											onclick={() => setSubscaleFilter(null)}
										>
											All subscales
										</button>
									{/if}
								</div>
							</div>
						</div>
					</div>

					<div
						class="min-w-0 flex-1 border-slate-200 bg-[#ebebeb] px-3 py-3"
					>
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

					<div
						class="box-border flex shrink-0 items-center border-l border-slate-200 bg-white px-4 py-3"
						style:width="{CONTEXT_RAIL_PX}px"
					>
						<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Context</div>
					</div>
				</div>

				<!-- Body: bump = one shared vertical scroll (statements + chart/context); radial = tray + main -->
				<div class="flex min-h-0 flex-1">
					{#if isBump}
						<div
							class="flex min-h-0 min-w-0 flex-1 items-start overflow-y-auto overflow-x-hidden bg-white"
						>
							<aside
								class="tray-slide shrink-0 overflow-hidden border-r border-slate-200 bg-white"
								style="width: {LEFT_TRAY_W}px;"
							>
								<div class="w-[360px] overflow-x-hidden">
									{#each $statementsViz.dim.items as item, i (item.item_id)}
										<div
											role="button"
											tabindex="0"
											class="box-border flex min-h-0 w-full cursor-pointer items-stretch border-b border-slate-300 bg-white py-2 pl-4 pr-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 {$selectedStatementId ===
											item.item_id
												? 'border-l-4 border-l-slate-900 bg-slate-50'
												: 'border-l-4 border-l-transparent hover:bg-slate-50/80'}"
											style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px;"
											onclick={() => setSelectedStatementId(item.item_id)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													setSelectedStatementId(item.item_id);
												}
											}}
										>
											<div class="flex min-h-0 min-w-0 flex-1 gap-2">
												<p
													class="min-h-0 min-w-0 flex-1 overflow-y-auto text-xs leading-snug text-slate-800 sm:text-sm"
												>
													{statementLabel(item)}
												</p>
												<div class="flex shrink-0 flex-col items-end gap-1 self-start sm:flex-row">
													{#if item.subscaleKey !== '__none__'}
														<button
															type="button"
															class="max-w-[9rem] truncate rounded-full px-2 py-0.5 text-left text-[10px] font-medium transition-colors {$selectedSubscaleFilter ===
															item.subscaleKey
																? 'border border-slate-300 bg-slate-200 text-slate-900 ring-2 ring-slate-900 ring-offset-1 ring-offset-white'
																: 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
															title={item.subscaleLabel}
															onclick={(e) => {
																e.stopPropagation();
																setSubscaleFilter(item.subscaleKey);
															}}
														>
															{item.subscaleLabel}
														</button>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							</aside>

							<div class="min-w-0 flex-1">
								<div
									class="grid bg-white"
									style:display="grid"
									style:grid-template-columns={bumpMainCols}
									style:column-gap="0"
									style:row-gap="0"
									style:grid-template-rows={`repeat(${n}, ${ROW_ITEM_HEIGHT}px)`}
								>
									<div
										class="viz-table-cell box-border flex min-h-0 min-w-0 flex-col border-r border-slate-300 bg-[#ebebeb] px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.05)]"
										style="grid-column: 1; grid-row: 1 / span {n};"
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
											style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 2; grid-row: {1 +
												i};"
										>
											<ContextPanel
												itemId={item.item_id}
												showStatement={$selectedStatementId === item.item_id}
											/>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{:else}
					<aside
						class="tray-slide shrink-0 overflow-hidden border-r border-slate-200 bg-white"
						style="width: 0px;"
						aria-hidden="true"
					>
						<div
							class="h-full max-h-full w-[360px] overflow-x-hidden"
							class:pointer-events-none={true}
							inert={true}
						></div>
					</aside>

					<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
							<div class="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
								<div
									class="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-300 bg-[#ebebeb] shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.05)]"
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
											onSubscaleWedgeClick={handleRadialSubscaleClick}
										/>
									</div>
								</div>
								<aside
									class="box-border min-h-0 shrink-0 overflow-y-auto border-l border-slate-200 bg-white"
									style:width="{CONTEXT_RAIL_PX}px"
								>
									<SubscaleList subscales={subscaleRail} focusedKey={focusedSubscaleKey} />
								</aside>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data.</p>
		{/if}
	</div>
</div>

<style>
	.tray-slide {
		transition: width 250ms ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.tray-slide {
			transition: none;
		}
	}
</style>
