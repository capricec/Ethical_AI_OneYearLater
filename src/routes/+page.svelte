<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		selectedModel,
		selectedStatementId,
		selectedSubscaleFilter,
		selectedViewMode,
		radialStatementOrder,
		statementsViz,
		setSelectedModel,
		setSelectedStatementId,
		setDimensionFilter,
		setSubscaleFilter,
		setRadialStatementOrder,
		setSelectedViewMode,
		VIEW_MODE_DIMENSION_BUMP,
		VIEW_MODE_RADIAL
	} from '$lib/stores/universalState.js';
	import { ROW_ITEM_HEIGHT } from '$lib/viz/dimensionChartLayout.js';
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import StatementsRadialChart from '$lib/viz/StatementsRadialChart.svelte';
	import ModelPills from '$lib/ui/ModelPills.svelte';
	import SubscaleList from '$lib/ui/SubscaleList.svelte';
	import { statementLabel } from '$lib/ui/statementLabel.js';
	import { scaleTextForValue } from '$lib/viz/valuePalette.js';

	/** Fixed statements column when Bump tray is open. */
	const LEFT_TRAY_W = 360;
	/** Fixed context / subscale rail (matches left tray width). */
	const CONTEXT_RAIL_PX = LEFT_TRAY_W;
	const EXPANDED_ROW_HEIGHT = 620;
	const EXPANDED_DETAIL_TOP_PAD = ROW_ITEM_HEIGHT + 5;
	const EXPANDED_DETAIL_ROW_H = 80;

	/** Dimension pills removed for now; avoid a stuck dimension-only filter. */
	onMount(() => {
		setDimensionFilter(null);
	});

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
	/** Scrolls the dimension rail to the subscale row (e.g. after wedge click). */
	let focusedSubscaleKey = $state(/** @type {string | null} */ (null));

	/** @param {unknown} k */
	function normSubscaleKey(k) {
		const s = String(k ?? '').trim();
		return s || '__none__';
	}

	/** Bump: filters the statement list. Radial: same store drives highlight only (viz does not filter). */
	function toggleSubscaleSelection(key) {
		const cur = get(selectedSubscaleFilter);
		const next = normSubscaleKey(cur) === normSubscaleKey(key) ? null : key;
		setSubscaleFilter(next);
		focusedSubscaleKey = next;
	}

	/** @param {string} subscaleKey */
	function handleRadialSubscaleClick(subscaleKey) {
		toggleSubscaleSelection(subscaleKey);
	}

	/** @param {string} key */
	function handleSubscaleRailSelect(key) {
		toggleSubscaleSelection(key);
	}

	/** @param {string} key */
	function handleStatementSubscalePillClick(key) {
		toggleSubscaleSelection(key);
	}

	function clearSubscaleHighlight() {
		setSubscaleFilter(null);
		focusedSubscaleKey = null;
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
			{@const bumpMainCols = `minmax(280px, 1fr)`}
			{@const bumpRowHeights = $statementsViz.dim.items.map((it) =>
				$selectedStatementId === it.item_id ? EXPANDED_ROW_HEIGHT : ROW_ITEM_HEIGHT
			)}
			{@const bumpRowTemplate = bumpRowHeights.map((h) => `${h}px`).join(' ')}

			<div
				class="flex h-[calc(100vh)] min-h-0 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-300"
			>
				{#if isBump}
					<!-- Statement view: header spans statement tray + chrome; body = list + bump chart -->
					<div class="flex shrink-0 border-b border-slate-200">
						<div
							class="tray-slide shrink-0 overflow-hidden border-r border-slate-200 bg-white"
							style="width: {LEFT_TRAY_W}px;"
						>
							<div class="box-border flex h-full w-[360px] flex-col justify-center px-4 py-3">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Statements
									</div>
									<div class="flex flex-wrap items-center justify-end gap-2">
										{#if $selectedSubscaleFilter != null && String($selectedSubscaleFilter).trim() !== ''}
											<button
												type="button"
												class="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
												onclick={clearSubscaleHighlight}
											>
												All subscales
											</button>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<div
							class="flex min-w-0 flex-1 items-center justify-between gap-3 border-slate-200 bg-[#ebebeb] px-3 py-3"
						>
							<div class="flex min-w-0 flex-wrap items-center gap-2">
								<span class="text-xs font-semibold uppercase tracking-widest text-slate-500"
									>Models</span
								>
								<ModelPills
									models={$statementsViz.modelSeries.map((m) => m.fundModel)}
									selected={$selectedModel}
									onSelect={setSelectedModel}
								/>
							</div>
							<div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
								<span class="text-xs font-semibold uppercase tracking-widest text-slate-500">View</span>
								<div
									class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-[10px] font-semibold"
									role="group"
									aria-label="View mode"
								>
									<button
										type="button"
										class="rounded px-2 py-1 transition-colors {$selectedViewMode ===
										VIEW_MODE_DIMENSION_BUMP
											? 'bg-slate-800 text-white'
											: 'text-slate-600 hover:bg-slate-100'}"
										onclick={() => setSelectedViewMode(VIEW_MODE_DIMENSION_BUMP)}
									>
										Statement
									</button>
									<button
										type="button"
										class="rounded px-2 py-1 transition-colors {$selectedViewMode ===
										VIEW_MODE_RADIAL
											? 'bg-slate-800 text-white'
											: 'text-slate-600 hover:bg-slate-100'}"
										onclick={() => setSelectedViewMode(VIEW_MODE_RADIAL)}
									>
										Dimension
									</button>
								</div>
							</div>
						</div>
					</div>

					<div class="flex min-h-0 flex-1">
						<div
							class="flex min-h-0 min-w-0 flex-1 items-start overflow-y-auto overflow-x-hidden bg-white"
						>
							<aside
								class="tray-slide shrink-0 overflow-hidden border-r border-slate-200 bg-white"
								style="width: {LEFT_TRAY_W}px;"
							>
								<div class="w-[360px] overflow-x-hidden">
									{#each $statementsViz.dim.items as item, i (item.item_id)}
										{@const rowH = bumpRowHeights[i] ?? ROW_ITEM_HEIGHT}
										{@const selectedRow = $selectedStatementId === item.item_id}
										{@const subscaleLocked =
											$selectedSubscaleFilter != null &&
											String($selectedSubscaleFilter).trim() !== ''}
										{@const subscaleMatch =
											!subscaleLocked ||
											normSubscaleKey(item.subscaleKey) ===
												normSubscaleKey($selectedSubscaleFilter)}
										<div
											role="button"
											tabindex="0"
											class="box-border flex min-h-0 w-full cursor-pointer items-stretch border-b border-slate-300 bg-white py-2 pl-4 pr-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 {!subscaleMatch
												? 'border-l-4 border-l-transparent opacity-20'
												: $selectedStatementId
													? selectedRow
														? 'border-l-4 border-l-slate-900 bg-slate-50'
														: 'border-l-4 border-l-transparent opacity-50'
													: 'border-l-4 border-l-transparent hover:bg-slate-50/80'}"
											style="height: {rowH}px; min-height: {rowH}px; max-height: {rowH}px;"
											onclick={() =>
												setSelectedStatementId(
													$selectedStatementId === item.item_id ? null : item.item_id
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													setSelectedStatementId(
														$selectedStatementId === item.item_id ? null : item.item_id
													);
												}
											}}
										>
											<div class="flex min-h-0 min-w-0 flex-1">
												<div class="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
													<p class="text-xs leading-snug text-slate-800 sm:text-sm">
														{statementLabel(item)}
													</p>
													{#if item.subscaleKey !== '__none__'}
														<button
															type="button"
															class="mt-2 max-w-[12rem] truncate rounded-full border px-2 py-0.5 text-left text-[10px] font-medium transition-colors {normSubscaleKey(item.subscaleKey) ===
															normSubscaleKey($selectedSubscaleFilter)
																? 'border-slate-900 bg-slate-50 text-slate-800 ring-2 ring-slate-400'
																: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
															title={item.subscaleLabel}
															onclick={(e) => {
																e.stopPropagation();
																handleStatementSubscalePillClick(item.subscaleKey);
															}}
														>
															{item.subscaleLabel}
														</button>
													{/if}
													{#if selectedRow}
														<div
															class="pointer-events-none absolute right-0 box-border"
															style="left: 10px; top: {EXPANDED_DETAIL_TOP_PAD}px;"
														>
															{#each $statementsViz.modelSeries.filter((ms) => !$selectedModel || ms.fundModel === $selectedModel) as ms (ms.fundModel)}
																{@const mean = ms.itemMeans[i]}
																{@const meanText = scaleTextForValue(
																	typeof mean === 'number' ? mean : NaN,
																	Array.isArray(item?.statement_scale) ? item.statement_scale : [],
																	Number(item?.scaleMin),
																	Number(item?.scaleMax),
																	Boolean(item?.reverse)
																)}
																<div class="box-border flex flex-col justify-center leading-tight" style="height: {EXPANDED_DETAIL_ROW_H}px;">
																	<div class="text-[11px] font-semibold text-slate-800">
																		{ms.fundModel}
																	</div>
																	<div class="text-[10px] text-slate-600">
																		Average response: {meanText || 'N/A'}
																	</div>
																</div>
															{/each}
														</div>
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
									style:grid-template-rows={bumpRowTemplate}
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
												selectedStatementId={$selectedStatementId}
												rowHeights={bumpRowHeights}
												highlightSubscaleKey={$selectedSubscaleFilter}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- Dimension view: top row matches Statement view (tray label | Models); rail + chart fill below -->
					<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<div class="flex shrink-0 border-b border-slate-200">
							<div
								class="tray-slide shrink-0 overflow-hidden border-r border-slate-200 bg-white"
								style="width: {CONTEXT_RAIL_PX}px;"
							>
								<div
									class="box-border flex h-full w-[360px] flex-col justify-center px-4 py-3"
								>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
											Dimensions
										</div>
									</div>
								</div>
							</div>
							<div
								class="flex min-w-0 flex-1 items-center justify-between gap-3 border-slate-200 bg-[#ebebeb] px-3 py-3"
							>
								<div class="flex min-w-0 flex-wrap items-center gap-2">
									<span class="text-xs font-semibold uppercase tracking-widest text-slate-500"
										>Models</span
									>
									<ModelPills
										models={$statementsViz.modelSeries.map((m) => m.fundModel)}
										selected={$selectedModel}
										onSelect={setSelectedModel}
									/>
								</div>
								<div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
									<span class="text-xs font-semibold uppercase tracking-widest text-slate-500"
										>View</span
									>
									<div
										class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-[10px] font-semibold"
										role="group"
										aria-label="View mode"
									>
										<button
											type="button"
											class="rounded px-2 py-1 transition-colors {$selectedViewMode ===
											VIEW_MODE_DIMENSION_BUMP
												? 'bg-slate-800 text-white'
												: 'text-slate-600 hover:bg-slate-100'}"
											onclick={() => setSelectedViewMode(VIEW_MODE_DIMENSION_BUMP)}
										>
											Statement
										</button>
										<button
											type="button"
											class="rounded px-2 py-1 transition-colors {$selectedViewMode ===
											VIEW_MODE_RADIAL
												? 'bg-slate-800 text-white'
												: 'text-slate-600 hover:bg-slate-100'}"
											onclick={() => setSelectedViewMode(VIEW_MODE_RADIAL)}
										>
											Dimension
										</button>
									</div>
								</div>
							</div>
						</div>
						<div class="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
							<aside
								class="box-border min-h-0 shrink-0 overflow-y-auto border-r border-slate-200 bg-white"
								style:width="{CONTEXT_RAIL_PX}px"
							>
								<SubscaleList
									subscales={subscaleRail}
									focusedKey={focusedSubscaleKey}
									selectedKey={$selectedSubscaleFilter}
									onSelect={handleSubscaleRailSelect}
								/>
							</aside>
							<div
								class="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-300 bg-[#ebebeb] shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.05)]"
							>
								<div
									bind:clientWidth={radialCellW}
									bind:clientHeight={radialCellH}
									class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2"
								>
									<div class="relative min-h-0 w-full flex-1">
										<StatementsRadialChart
											width={radialSquare}
											height={radialSquare}
											viz={$statementsViz}
											selectedModel={$selectedModel}
											radialSortMode={$radialStatementOrder}
											onRadialSortModeChange={setRadialStatementOrder}
											highlightSubscaleKey={$selectedSubscaleFilter}
											onSubscaleWedgeClick={handleRadialSubscaleClick}
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
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
