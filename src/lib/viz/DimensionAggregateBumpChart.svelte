<script>
	import * as d3 from 'd3';
	import {
		CHART_MARGIN_TOP,
		CHART_MARGIN_BOTTOM,
		CHART_SIDE_GUTTER,
		ROW_ITEM_HEIGHT
	} from '$lib/viz/dimensionChartLayout.js';
	import { fillColorForItem, scaleTextForValue } from '$lib/viz/valuePalette.js';

	const PANEL_BG = '#ebebeb';

	const ITEM_LINE_STROKE = '#cfcfcf';
	const NON_SELECTED_PATH_STROKE = '#9ca3af';
	const SELECTED_PATH_STROKE = '#0a0a0a';

	/**
	 * @typedef {object} Viz
	 * @property {{ items: object[] }} dim
	 * @property {{ fundModel: string, itemMeans: (number|null)[] }[]} modelSeries
	 * @property {[number, number][]} itemExtents
	 * @property {{ aggregate: { left: string, right: string }, item: { left: string, right: string } }} labels
	 */

	/** @type {{ width: number, viz: Viz, selectedModel: string }} */
	let { width, viz, selectedModel } = $props();
	/** @type {string | null} */
	let hoveredModel = $state(null);
	/** @type {{ x: number, y: number, model: string, responseText: string } | null} */
	let tooltip = $state(null);

	const margin = { top: CHART_MARGIN_TOP, bottom: CHART_MARGIN_BOTTOM, side: CHART_SIDE_GUTTER };
	const TOOLTIP_WIDTH = 170;
	const TOOLTIP_HEIGHT = 56;
	const TOOLTIP_PADDING = 8;

	const height = $derived(
		viz
			? CHART_MARGIN_TOP + CHART_MARGIN_BOTTOM + viz.dim.items.length * ROW_ITEM_HEIGHT
			: 120
	);

	const innerWidth = $derived(Math.max(120, width - margin.side * 2));
	const activeModel = $derived(hoveredModel ?? selectedModel);

	const rowCentersY = $derived.by(() => {
		if (!viz) return [];
		const ys = [];
		for (let i = 0; i < viz.dim.items.length; i++) {
			ys.push(margin.top + (i + 0.5) * ROW_ITEM_HEIGHT);
		}
		return ys;
	});

	function isBlank(value) {
		return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
	}

	function truncateFirstTwoWords(text) {
		if (isBlank(text)) return '';
		const words = String(text).trim().split(/\s+/).filter(Boolean);
		return words.slice(0, 2).join(' ');
	}

	/** @param {object} item */
	function endpointTextForSide(item, side) {
		const dimId = item?.dimensionId;

		const itemSv = item?.statement_values;
		let raw = !isBlank(itemSv?.[side])
			? itemSv?.[side]
			: !isBlank(item?.dimStatementValues?.[side])
				? item?.dimStatementValues?.[side]
				: undefined;

		if (isBlank(raw)) raw = side === 'min' ? viz?.labels?.item?.left : viz?.labels?.item?.right;

		const str = isBlank(raw) ? '' : String(raw);
		return dimId === 27 ? truncateFirstTwoWords(str) : str;
	}

	const xScales = $derived.by(() => {
		if (!viz) return [];
		const scales = [];
		for (let i = 0; i < viz.dim.items.length; i++) {
			const ext = viz.itemExtents[i] ?? [0, 1];
			scales.push(d3.scaleLinear().domain(ext).range([0, innerWidth]));
		}
		return scales;
	});

	const rStmtSelected = 9;
	const rStmtOther = 7;

	/**
	 * @param {{ fundModel: string, itemMeans: (number|null)[] }} m
	 * @returns {[number, number][]}
	 */
	function modelPoints(m) {
		if (!viz || !xScales.length) return [];
		const ys = rowCentersY;
		/** @type {[number, number][]} */
		const pts = [];
		for (let i = 0; i < m.itemMeans.length; i++) {
			const v = m.itemMeans[i];
			if (v === null || v === undefined || Number.isNaN(v)) continue;
			pts.push([xScales[i](v), ys[i]]);
		}
		return pts;
	}

	const linePath = d3
		.line()
		.x((d) => d[0])
		.y((d) => d[1])
		.curve(d3.curveCatmullRom.alpha(0.65));

	function pathD(m) {
		const pts = modelPoints(m);
		if (pts.length < 2) return '';
		return linePath(pts) ?? '';
	}

	function clampTooltipPosition(rawX, rawY) {
		const maxX = Math.max(TOOLTIP_PADDING, width - TOOLTIP_WIDTH - TOOLTIP_PADDING);
		const maxY = Math.max(TOOLTIP_PADDING, height - TOOLTIP_HEIGHT - TOOLTIP_PADDING);
		return {
			x: Math.max(TOOLTIP_PADDING, Math.min(maxX, rawX)),
			y: Math.max(TOOLTIP_PADDING, Math.min(maxY, rawY))
		};
	}

	function setHover(event, model, responseText) {
		hoveredModel = model;
		const rect = event.currentTarget?.ownerSVGElement?.getBoundingClientRect();
		const localX = rect ? event.clientX - rect.left : 0;
		const localY = rect ? event.clientY - rect.top : 0;
		const pos = clampTooltipPosition(localX + 12, localY - TOOLTIP_HEIGHT - 8);
		tooltip = {
			x: pos.x,
			y: pos.y,
			model,
			responseText: responseText || ''
		};
	}

	function clearHover() {
		hoveredModel = null;
		tooltip = null;
	}
</script>

{#if !viz}
	<p class="text-sm text-slate-500">No data.</p>
{:else}
	<div class="chart-wrap" style="width: {width}px; height: {height}px;">
		<svg
			width={width}
			height={height}
			style="overflow: visible"
			class="block max-w-full shrink-0 self-start"
			role="img"
		>
			<title>Model positions by statement</title>
			<rect x="0" y="0" width={width} height={height} fill={PANEL_BG} />

			<g transform="translate({margin.side},0)" style="overflow: visible">
				{#each viz.dim.items as item, ri (item.item_id)}
					{@const yi = rowCentersY[ri]}
					{@const baseMin = endpointTextForSide(item, 'min')}
					{@const baseMax = endpointTextForSide(item, 'max')}
					{@const rowLeft = item?.reverse ? baseMax : baseMin}
					{@const rowRight = item?.reverse ? baseMin : baseMax}
					<text
						x={-10}
						y={yi}
						fill="#57534e"
						font-size="11"
						font-weight="400"
						text-anchor="end"
						dominant-baseline="middle"
					>
						{rowLeft}
					</text>
					<text
						x={innerWidth + 10}
						y={yi}
						fill="#57534e"
						font-size="11"
						font-weight="400"
						text-anchor="start"
						dominant-baseline="middle"
					>
						{rowRight}
					</text>
					<line
						x1="0"
						x2={innerWidth}
						y1={yi}
						y2={yi}
						stroke={ITEM_LINE_STROKE}
						stroke-width="1"
					/>
				{/each}

				{#each [...viz.modelSeries].sort((a, b) => {
					if (a.fundModel === activeModel) return 1;
					if (b.fundModel === activeModel) return -1;
					return 0;
				}) as m (m.fundModel)}
					{@const selected = m.fundModel === activeModel}
					{@const d = pathD(m)}
					{#if d}
						<path
							fill="none"
							stroke={selected ? SELECTED_PATH_STROKE : NON_SELECTED_PATH_STROKE}
							stroke-width={selected ? 2.75 : 1.25}
							opacity={selected ? 1 : 0.38}
							{d}
						/>
					{/if}
					{@const rDot = selected ? rStmtSelected : rStmtOther}
					{#each m.itemMeans as value, itemIndex (itemIndex)}
						{#if value !== null && value !== undefined && !Number.isNaN(value)}
							{@const ptX = xScales[itemIndex](value)}
							{@const item = viz.dim.items[itemIndex]}
							{@const min = Number(item?.scaleMin)}
							{@const max = Number(item?.scaleMax)}
							{@const itemScaleTexts = Array.isArray(item?.statement_scale) && item.statement_scale.length
								? item.statement_scale
								: []}
							{@const responseText = scaleTextForValue(
								value,
								itemScaleTexts,
								min,
								max,
								Boolean(item?.reverse)
							)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<circle
								cx={ptX}
								cy={rowCentersY[itemIndex]}
								r={rDot}
								fill={fillColorForItem(item, value)}
								stroke={selected ? '#0a0a0a' : 'transparent'}
								stroke-width={selected ? 2 : 0}
								stroke-opacity={selected ? 1 : 0.85}
								opacity={1}
								onmouseenter={(event) => setHover(event, m.fundModel, responseText)}
								onmousemove={(event) => setHover(event, m.fundModel, responseText)}
								onmouseleave={clearHover}
							/>
						{/if}
					{/each}
				{/each}
			</g>
		</svg>
		{#if tooltip}
			<div
				class="tooltip"
				style="left: {tooltip.x}px; top: {tooltip.y}px;"
				aria-hidden="true"
			>
				<div class="tooltip-model">{tooltip.model}</div>
				{#if tooltip.responseText}
					<div class="tooltip-value">Average Response: {tooltip.responseText}</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.chart-wrap {
		position: relative;
	}

	.tooltip {
		position: absolute;
		pointer-events: none;
		min-width: 120px;
		max-width: 170px;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid #d6d3d1;
		background: rgba(255, 255, 255, 0.96);
		color: #1c1917;
		font-size: 11px;
		line-height: 1.3;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
		z-index: 10;
	}

	.tooltip-model {
		font-weight: 600;
	}
</style>
