<script>
	import {
		selectedModel,
		selectedStatementId,
		selectedDimension,
		dimensionViz,
		setSelectedModel,
		setSelectedStatementId,
		setSelectedDimension
	} from '$lib/stores/universalState.js';
	import { encoding } from '$lib/data/dataset.js';
	import { ROW_AGG_HEIGHT, ROW_ITEM_HEIGHT } from '$lib/viz/dimensionChartLayout.js';
	import DimensionAggregateBumpChart from '$lib/viz/DimensionAggregateBumpChart.svelte';
	import ModelPills from '$lib/ui/ModelPills.svelte';
	import ContextPanel from '$lib/ui/ContextPanel.svelte';

	let chartWidth = $state(0);

	function constructTitle(construct) {
		if (!construct) return 'Dimension';
		return construct.replace(/_/g, ' ');
	}

	function onDimensionChange(/** @type {Event} */ e) {
		const el = e.currentTarget;
		if (el instanceof HTMLSelectElement) setSelectedDimension(Number(el.value));
	}

	/**
	 * Forced-choice pairs (e.g. id 27) store `left/right` instead of `text`.
	 * Render a consistent statement label for the table.
	 * @param {{ text?: string, left?: string, right?: string, item_id: string }} item
	 */
	function statementLabel(item) {
		if (item?.text) return item.text;
		if (item?.left && item?.right) {
			// For forced-choice pairs in dimension 27, some items must be reversed.
			if ($selectedDimension === 27 && item.reverse === true) return `${item.right} vs. ${item.left}`;
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
		{#if $dimensionViz}
			{@const n = $dimensionViz.dim.items.length}
			{@const span = n + 1}

			<div
				class="overflow-hidden rounded-lg bg-white ring-1 ring-slate-300 flex flex-col h-[calc(100vh)]"
			>
				<!-- Static tray headers (not part of the body grid) -->
				<div
					class="grid"
					style:display="grid"
					style:grid-template-columns="minmax(240px, 320px) minmax(280px, 1fr) minmax(220px, 300px)"
					style:column-gap="0"
					style:row-gap="0"
				>
					<!-- Left tray header -->
					<div class="bg-white px-4 py-3">
						<div class="flex items-center justify-between">
							<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ethical Dimensions</div>
						</div>
					</div>

					<!-- Center tray header -->
					<div class="bg-[#ebebeb] px-3 py-3">
						<div class="flex flex-col items-center justify-center gap-2">
							<div class="text-xs font-semibold uppercase tracking-widest text-slate-500">Models</div>
							<ModelPills
								models={$dimensionViz.modelSeries.map((m) => m.fundModel)}
								selected={$selectedModel}
								onSelect={setSelectedModel}
							/>
						</div>
					</div>

					<!-- Right tray header -->
					<div class="bg-white px-4 py-3">
						<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Context</div>
					</div>
				</div>

				<!-- Shared scrollable body grid (all aligned rows live here) -->
				<div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
					<div
						class="grid bg-white"
						style:display="grid"
						style:grid-template-columns="minmax(240px, 320px) minmax(280px, 1fr) minmax(220px, 300px)"
						style:column-gap="0"
						style:row-gap="0"
						style:grid-template-rows={`${ROW_AGG_HEIGHT}px repeat(${n}, ${ROW_ITEM_HEIGHT}px)`}
					>
						<!-- Overall row (left + right); chart spans full body height -->
						<div
							class="box-border flex items-center border-b border-slate-300 bg-white"
							style="height: {ROW_AGG_HEIGHT}px; min-height: {ROW_AGG_HEIGHT}px; max-height: {ROW_AGG_HEIGHT}px; grid-column: 1; grid-row: 1;"
						>
							<div class="flex min-h-0 min-w-0 items-center gap-2 text-sm font-semibold leading-tight text-slate-800">
								<span class="shrink-0 text-slate-400" aria-hidden="true"></span>
							<div class="relative w-full">
								<select
									id="dim-select"
									class="w-full appearance-none rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium capitalize"
									value={String($selectedDimension)}
									onchange={onDimensionChange}
								>
									{#each encoding as dim (dim.id)}
										<option value={String(dim.id)}>{dim.title ?? constructTitle(dim.construct)}</option>
									{/each}
								</select>
								<span
									class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
									>▾</span
								>
							</div>
							</div>
						</div>

						<div
							class="viz-table-cell box-border flex min-h-0 min-w-0 flex-col border-x border-slate-300 bg-[#ebebeb] px-2 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.05)]"
							style="grid-column: 2; grid-row: 1 / span {span};"
						>
							<div
								bind:clientWidth={chartWidth}
								class="flex h-full min-h-0 w-full flex-1 items-stretch"
							>
								<DimensionAggregateBumpChart
									width={Math.max(chartWidth, 280)}
									viz={$dimensionViz}
									selectedModel={$selectedModel}
								/>
							</div>
						</div>

						<div
							class="box-border flex items-center border-b border-slate-300 bg-white "
							style="height: {ROW_AGG_HEIGHT}px; min-height: {ROW_AGG_HEIGHT}px; max-height: {ROW_AGG_HEIGHT}px; grid-column: 3; grid-row: 1;"
						>
							<ContextPanel showAggregate={true} showStatement={false} />
						</div>

						{#each $dimensionViz.dim.items as item, i (item.item_id)}
							<!-- Statement row (left) -->
							<div
								class="box-border flex items-center border-b border-slate-300 bg-white"
								style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 1; grid-row: {2 + i};"
							>
								<button
									type="button"
									class="flex h-full min-h-0 w-full min-w-0 items-start gap-3 rounded-md border pl-5 pr-4 py-3 text-left text-xs leading-snug transition-colors sm:text-sm {$selectedStatementId === item.item_id
										? 'border-slate-900 bg-slate-50'
										: 'border-transparent bg-transparent hover:bg-slate-50'}"
									onclick={() => setSelectedStatementId(item.item_id)}
								>
									<span class="line-clamp-2 text-slate-800">{statementLabel(item)}</span>
								</button>
							</div>

							<!-- Statement row (right) -->
							<div
								class="box-border flex items-center border-b border-slate-300 bg-white"
								style="height: {ROW_ITEM_HEIGHT}px; min-height: {ROW_ITEM_HEIGHT}px; max-height: {ROW_ITEM_HEIGHT}px; grid-column: 3; grid-row: {2 + i};"
							>
								<ContextPanel
									showAggregate={false}
									showStatement={$selectedStatementId === item.item_id}
								/>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<p class="p-4 text-sm text-slate-500">No data for this dimension.</p>
		{/if}
	</div>
</div>
