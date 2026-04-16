<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		selectedModel,
		selectedStatementId,
		selectedSubscaleFilter,
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
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import StatementsRadialChart from '$lib/viz/StatementsRadialChart.svelte';
	import ModelPills from '$lib/ui/ModelPills.svelte';
	import QuestionBar from '$lib/ui/QuestionBar.svelte';
	import { statementLabel } from '$lib/ui/statementLabel.js';
	import { questions, statementContext } from '$lib/data/dataset.js';
	import { sliceVizToSingleStatement } from '$lib/data/vizSliceSingleStatement.js';

	/** @type {Map<string, string>} */
	const STATEMENT_CONTEXT_BY_ID = new Map();
	for (const group of statementContext) {
		for (const it of group.items ?? []) {
			if (it?.item_id) STATEMENT_CONTEXT_BY_ID.set(String(it.item_id), String(it.context ?? ''));
		}
	}

	/** Fixed statements column when Bump tray is open. */
	const LEFT_TRAY_W = 360;
	/** Fixed context / subscale rail (matches left tray width). */
	const EXPANDED_ROW_HEIGHT = 620;

	/** Dimension pills removed for now; avoid a stuck dimension-only filter. */
	onMount(() => {
		setDimensionFilter(null);
	});

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);

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
	}

	/** @param {string} subscaleKey */
	function handleRadialSubscaleClick(subscaleKey) {
		toggleSubscaleSelection(subscaleKey);
	}

	/** @param {string} key */
	function handleSubscaleRailSelect(key) {
		toggleSubscaleSelection(key);
	}

	function clearSubscaleHighlight() {
		setSubscaleFilter(null);
	}

	$effect(() => {
		const id = $selectedStatementId;
		const hasStatement = id != null && String(id).trim() !== '';
		setSelectedViewMode(hasStatement ? VIEW_MODE_DIMENSION_BUMP : VIEW_MODE_RADIAL);
	});

	/** @param {string | null} itemId */
	function applyStatementSelection(itemId) {
		if (itemId == null || itemId === '') {
			setSelectedStatementId(null);
			return;
		}
		setSelectedStatementId(itemId);
	}

	/** @param {string | null} itemId */
	function handleQuestionSelect(itemId) {
		applyStatementSelection(itemId);
	}

	/**
	 * Left-tray statement list: same filters as before, ordered by cross-model divergence (high → low).
	 * @param {{ dim?: { items?: { item_id: string, subscaleKey?: string }[] }, statementDivergence?: { item_id: string, divergence: number }[] } | null | undefined} viz
	 * @param {string | null} selectedStmtId
	 * @param {string | null} subscaleF
	 */
	function trayStatementItems(viz, selectedStmtId, subscaleF) {
		if (!viz?.dim?.items?.length) return [];
		const divMap = new Map(
			(viz.statementDivergence ?? []).map((d) => [
				d.item_id,
				typeof d.divergence === 'number' && !Number.isNaN(d.divergence) ? d.divergence : 0
			])
		);
		const sid =
			selectedStmtId != null && String(selectedStmtId).trim() !== ''
				? String(selectedStmtId)
				: null;
		const filtered = viz.dim.items.filter((it) => {
			if (sid) return it.item_id === sid;
			if (subscaleF != null && String(subscaleF).trim() !== '')
				return normSubscaleKey(it.subscaleKey) === normSubscaleKey(subscaleF);
			return true;
		});
		return [...filtered].sort(
			(a, b) => (divMap.get(b.item_id) ?? 0) - (divMap.get(a.item_id) ?? 0)
		);
	}
</script>

<svelte:head>
	<title>Ethical AI — One Year Later</title>
</svelte:head>

<div class="min-h-screen bg-slate-100 text-slate-900">
	<div class="">
		{#if $statementsViz}
			{@const isStatementView =
				$selectedStatementId != null && String($selectedStatementId).trim() !== ''}
			{@const radialSquare = Math.max(
				260,
				Math.floor(
					Math.min(Math.max(radialCellW, 1) - 16, Math.max(radialCellH, 1) - 16)
				)
			)}
			{@const subscaleRail = $statementsViz.subscalesInOrder ?? []}
			{@const trayStatements = trayStatementItems(
				$statementsViz,
				$selectedStatementId,
				$selectedSubscaleFilter
			)}
			{@const bumpViz = $selectedStatementId
				? sliceVizToSingleStatement($statementsViz, $selectedStatementId)
				: null}
			{@const bumpSingleRowHeights = bumpViz ? [EXPANDED_ROW_HEIGHT] : []}

			<div
				class="flex h-[calc(100vh)] min-h-0 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-300"
			>
				<div class="flex min-h-0 flex-1 flex-row overflow-hidden">
					<!-- Dashboard: models, dimensions, statements -->
					<aside
						class="box-border flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white"
						style="width: {LEFT_TRAY_W}px;"
					>
						<div class="shrink-0 border-b border-slate-200 px-4 pb-4 pt-4">
							<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Models</div>
							<div class="mt-3 w-full min-w-0">
								<ModelPills
									models={$statementsViz.modelSeries.map((m) => m.fundModel)}
									selected={$selectedModel}
									onSelect={setSelectedModel}
								/>
							</div>
						</div>
						<div
							class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,3fr)_auto_minmax(0,2fr)] overflow-hidden"
						>
							<div class="shrink-0 px-4 pb-2 pt-4">
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Dimensions
								</div>
							</div>
							<div class="min-h-0 overflow-y-auto border-b border-b-20 border-white bg-white">
								<div class="space-y-2 px-4 pb-1 pt-1 mb-4">
									{#each subscaleRail as s (s.key)}
										{@const dimSelected =
											$selectedSubscaleFilter != null &&
											normSubscaleKey($selectedSubscaleFilter) === normSubscaleKey(s.key)}
										<div class="relative">
											<button
												type="button"
												class="w-full rounded-md border px-3 py-2.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 {dimSelected
													? 'border-slate-900 bg-slate-50 pr-10 ring-2 ring-slate-400'
													: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}"
												onclick={() => handleSubscaleRailSelect(s.key)}
											>
												<div
													class="text-sm leading-snug text-slate-900 {dimSelected
														? 'font-semibold'
														: 'font-normal'}"
												>
													{s.label}
												</div>
												{#if dimSelected && s.description}
													<p class="mt-2 text-xs leading-relaxed text-slate-600">{s.description}</p>
												{/if}
											</button>
											{#if dimSelected}
												<button
													type="button"
													class="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-base font-light leading-none text-slate-500 hover:bg-slate-200 hover:text-slate-900"
													aria-label="Clear dimension"
													onclick={(e) => {
														e.stopPropagation();
														clearSubscaleHighlight();
													}}
												>
													×
												</button>
											{/if}
										</div>
									{/each}
								</div>
							</div>
							<div class="shrink-0 bg-white px-4 pb-2 pt-3 border-t border-t-1 border-slate-200">
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Statements
								</div>
							</div>
							<div class="min-h-0 overflow-y-auto">
								<div class="space-y-2 px-4 pb-4 pt-1">
									{#each trayStatements as item (item.item_id)}
										{@const selectedRow = $selectedStatementId === item.item_id}
										{@const ctx = STATEMENT_CONTEXT_BY_ID.get(String(item.item_id)) ?? ''}
										<div class="relative">
											<button
												type="button"
												class="w-full rounded-md border px-3 py-2.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 {selectedRow
													? 'border-slate-900 bg-slate-50 pr-10 ring-2 ring-slate-400'
													: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}"
												onclick={() => {
													const next =
														$selectedStatementId === item.item_id ? null : item.item_id;
													if (next) applyStatementSelection(next);
													else setSelectedStatementId(null);
												}}
											>
												<div
													class="text-sm leading-snug text-slate-900 {selectedRow
														? 'font-semibold'
														: 'font-normal'}"
												>
													{statementLabel(item)}
												</div>
												{#if selectedRow && ctx}
													<p class="mt-2 text-xs leading-relaxed text-slate-600">{ctx}</p>
												{/if}
											</button>
											{#if selectedRow}
												<button
													type="button"
													class="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-base font-light leading-none text-slate-500 hover:bg-slate-200 hover:text-slate-900"
													aria-label="Clear statement"
													onclick={(e) => {
														e.stopPropagation();
														setSelectedStatementId(null);
													}}
												>
													×
												</button>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>
					</aside>

					<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<header
							class="flex min-w-0 shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-[#ebebeb] px-4 py-4"
						>
							<div class="flex min-w-0 flex-1">
								<QuestionBar
									{questions}
									selectedItemId={$selectedStatementId}
									onSelect={handleQuestionSelect}
								/>
							</div>
						</header>

						<div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
							{#if isStatementView}
								{#if bumpViz}
									<div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#ebebeb]">
										<div
											bind:clientWidth={chartWidth}
											class="box-border flex min-h-0 flex-1 flex-col px-2 py-2"
										>
											<DimensionAggregateBumpChart
												width={Math.max(chartWidth, 280)}
												viz={bumpViz}
												selectedModel={$selectedModel}
												selectedStatementId={$selectedStatementId}
												rowHeights={bumpSingleRowHeights}
												highlightSubscaleKey={$selectedSubscaleFilter}
											/>
										</div>
									</div>
								{:else}
									<div
										class="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-500"
									>
										Choose a question above or a statement on the left to see model heatmaps.
									</div>
								{/if}
							{:else}
								<div
									bind:clientWidth={radialCellW}
									bind:clientHeight={radialCellH}
									class="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#ebebeb] p-2"
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
							{/if}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data.</p>
		{/if}
	</div>
</div>

