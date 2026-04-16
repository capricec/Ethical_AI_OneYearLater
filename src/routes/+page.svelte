<script>
	import { onMount, tick } from 'svelte';
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

	/** Fixed context / subscale rail (matches left tray width). */
	/** Dimension pills removed for now; avoid a stuck dimension-only filter. */
	onMount(() => {
		setDimensionFilter(null);
	});

	let chartWidth = $state(0);
	let radialCellW = $state(0);
	let radialCellH = $state(0);
	/** Bump statement view: flex slot height so the SVG row fills the viewport. */
	let statementBumpSlotH = $state(0);

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

	/** Stable `id` for dimension-rail rows (scroll into view). */
	function subscaleRailRowId(/** @type {unknown} */ key) {
		return `subscale-rail-${String(key ?? '')
			.trim()
			.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
	}

	/** Same toggle behavior as the statement list in the left tray. */
	function handleRadialStatementSelect(/** @type {string} */ itemId) {
		const id = String(itemId ?? '').trim();
		if (!id) return;
		const next = $selectedStatementId === id ? null : id;
		if (next) applyStatementSelection(next);
		else setSelectedStatementId(null);
	}

	$effect(() => {
		const key = $selectedSubscaleFilter;
		if (key == null || String(key).trim() === '') return;
		const domId = subscaleRailRowId(key);
		tick().then(() => {
			const el = document.getElementById(domId);
			el?.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'center' });
		});
	});

	/** Stable `id` per statement tray row (scroll into view). */
	function trayStatementRowId(/** @type {unknown} */ itemId) {
		return `tray-statement-${String(itemId ?? '')
			.trim()
			.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
	}

	$effect(() => {
		const id = $selectedStatementId;
		if (id == null || String(id).trim() === '') return;
		const domId = trayStatementRowId(id);
		tick().then(() => {
			const el = document.getElementById(domId);
			el?.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
		});
	});

	/**
	 * Left-tray statement list: ordered by cross-model divergence (high → low).
	 * Only filters by **subscale** when a subscale is chosen; statement selection
	 * never hides other rows (the selected one just scrolls into view).
	 * @param {{ dim?: { items?: { item_id: string, subscaleKey?: string }[] }, statementDivergence?: { item_id: string, divergence: number }[] } | null | undefined} viz
	 * @param {string | null} subscaleF
	 */
	function trayStatementItems(viz, subscaleF) {
		if (!viz?.dim?.items?.length) return [];
		const divMap = new Map(
			(viz.statementDivergence ?? []).map((d) => [
				d.item_id,
				typeof d.divergence === 'number' && !Number.isNaN(d.divergence) ? d.divergence : 0
			])
		);
		const filtered = viz.dim.items.filter((it) => {
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

<div class="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
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
			{@const trayStatements = trayStatementItems($statementsViz, $selectedSubscaleFilter)}
			{@const bumpViz = $selectedStatementId
				? sliceVizToSingleStatement($statementsViz, $selectedStatementId)
				: null}
			<!-- Min row height must fit all model heatmap/timeline rows (matches compact vs desktop spacing in DimensionAggregateBumpChart). -->
			<!-- Matches compact detailTopPad + model rows + heatmap bar (see DimensionAggregateBumpChart). -->
			{@const stmtDetailMinH = bumpViz
				? chartWidth === 0 || chartWidth < 768
					? 95 + bumpViz.modelSeries.length * 54
					: 214 + bumpViz.modelSeries.length * 100
				: 0}
			{@const bumpSingleRowHeights = bumpViz
				? [Math.max(statementBumpSlotH > 0 ? statementBumpSlotH : 360, stmtDetailMinH)]
				: []}

			<div
				class="flex h-[100vh] min-h-0 flex-col overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-300"
			>
				<div class="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
					<!-- Dashboard: models, dimensions, statements -->
					<aside
						class="box-border flex w-full max-w-full shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-[#F7F7F7] order-2 md:order-1 h-[35vh] md:h-auto md:w-[360px] md:max-w-none md:border-r md:border-t-0"
					>
						<div class="flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-visible">
							<div class="shrink-0 border-b border-slate-200 px-4 pb-4 pt-4">
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Models
								</div>
								<div class="mt-3 w-full min-w-0">
									<ModelPills
										models={$statementsViz.modelSeries.map((m) => m.fundModel)}
										selected={$selectedModel}
										onSelect={setSelectedModel}
									/>
								</div>
							</div>
							<div
								class="flex min-h-0 flex-1 flex-col md:grid md:grid-rows-[auto_minmax(0,3fr)_auto_minmax(0,2fr)] md:overflow-hidden"
							>
								<div class="shrink-0 px-4 pb-2 pt-4">
									<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Dimensions
									</div>
								</div>
							<div
								class="min-h-0 shrink-0 overflow-visible border-b border-slate-200 md:min-h-0 md:shrink md:overflow-y-auto"
							>
								<div class="space-y-2 px-4 pb-1 pt-1 mb-4">
									{#each subscaleRail as s (s.key)}
										{@const dimSelected =
											$selectedSubscaleFilter != null &&
											normSubscaleKey($selectedSubscaleFilter) === normSubscaleKey(s.key)}
										<div class="relative" id={subscaleRailRowId(s.key)}>
											<button
												type="button"
												class="w-full rounded-md border px-3 py-2.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 {dimSelected
													? 'border-slate-900 bg-white pr-10 ring-2 ring-slate-400'
													: 'border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white'}"
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
							<div class="shrink-0 border-t border-slate-200 px-4 pb-2 pt-3">
								<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
									Statements
								</div>
							</div>
							<div class="min-h-0 shrink-0 overflow-visible md:min-h-0 md:shrink md:overflow-y-auto">
								<div class="space-y-2 px-4 pb-4 pt-1">
									{#each trayStatements as item (item.item_id)}
										{@const selectedRow = $selectedStatementId === item.item_id}
										{@const ctx = STATEMENT_CONTEXT_BY_ID.get(String(item.item_id)) ?? ''}
										<div class="relative" id={trayStatementRowId(item.item_id)}>
											<button
												type="button"
												class="w-full rounded-md border px-3 py-2.5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 {selectedRow
													? 'border-slate-900 bg-white pr-10 ring-2 ring-slate-400'
													: 'border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white'}"
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
						</div>
					</aside>

					<div
						class="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-white order-1 md:order-2 h-[65vh] md:h-auto"
					>
						<header
							class="flex min-w-0 shrink-0 flex-wrap items-center justify-center gap-2 bg-white px-3 md:gap-3 md:px-4 md:py-5 {isStatementView
								? 'pt-2.5 pb-3'
								: 'py-2.5'}"
						>
							<div class="flex min-w-0 w-full max-w-4xl flex-1 justify-center">
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
									<div
										class="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-white -mt-1.5 md:mt-0"
									>
										<div
											class="mx-auto flex min-h-0 min-w-0 w-full max-w-6xl flex-1 flex-col pl-4 pr-2 pb-2 pt-0 md:px-4 md:pb-4 md:pt-3"
										>
											<h2
												class="mb-2 hidden max-w-4xl shrink-0 self-center text-center text-base font-bold leading-snug text-slate-900 sm:text-lg md:block"
											>
												{statementLabel(bumpViz.dim.items[0])}
											</h2>
											<div
												bind:clientWidth={chartWidth}
												bind:clientHeight={statementBumpSlotH}
												class="box-border flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col self-stretch md:max-w-5xl"
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
									</div>
								{:else}
									<div
										class="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-500"
									>
										Choose a question above or a statement on the left to see model responses.
									</div>
								{/if}
							{:else}
								<div
									bind:clientWidth={radialCellW}
									bind:clientHeight={radialCellH}
									class="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-2"
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
											onStatementSelect={handleRadialStatementSelect}
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

