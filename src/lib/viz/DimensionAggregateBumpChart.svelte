<script>
	import * as d3 from 'd3';
	import {
		CHART_MARGIN_TOP,
		CHART_MARGIN_BOTTOM,
		CHART_SIDE_GUTTER,
		ROW_AGG_HEIGHT,
		ROW_ITEM_HEIGHT
	} from '$lib/viz/dimensionChartLayout.js';

	const PANEL_BG = '#ebebeb';

	/** Dark grey pill (overall row) */
	const AGG_TRACK_FILL = '#cecece';
	const AGG_TRACK_STROKE = '#3f3f46';

	const ITEM_LINE_STROKE = '#cfcfcf';
	const NON_SELECTED_PATH_STROKE = '#9ca3af';
	const SELECTED_PATH_STROKE = '#0a0a0a';

	const VALUE_PALETTE_1_TO_6 = ['#05436F', '#82B8D1', '#D1E8F0', '#FEDBC7', '#D75F29', '#A4321C'];
	const VALUE_PALETTE_1_TO_10 = [
		'#05436F',
		'#0165AB',
		'#82B8D1',
		'#AADAEB',
		'#D1E8F0',
		'#FEDBC7',
		'#F6A482',
		'#D75F29',
		'#CC4226',
		'#A4321C'
	];

	/**
	 * @typedef {object} Viz
	 * @property {{ items: { item_id: string, text?: string }[], construct?: string }} dim
	 * @property {{ fundModel: string, itemMeans: (number|null)[], aggregate: number }[]} modelSeries
	 * @property {[number, number]} aggregateExtent
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
			? CHART_MARGIN_TOP +
				CHART_MARGIN_BOTTOM +
				ROW_AGG_HEIGHT +
				viz.dim.items.length * ROW_ITEM_HEIGHT
			: 120
	);

	const innerWidth = $derived(Math.max(120, width - margin.side * 2));
	const activeModel = $derived(hoveredModel ?? selectedModel);

	const rowCentersY = $derived.by(() => {
		if (!viz) return [];
		const ys = [margin.top + ROW_AGG_HEIGHT / 2];
		for (let i = 0; i < viz.dim.items.length; i++) {
			ys.push(margin.top + ROW_AGG_HEIGHT + (i + 0.5) * ROW_ITEM_HEIGHT);
		}
		return ys;
	});

	function isBlank(value) {
		return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
	}

	// Keep endpoint labels short and consistent with the mock.
	function truncateFirstTwoWords(text) {
		if (isBlank(text)) return '';
		const words = String(text).trim().split(/\s+/).filter(Boolean);
		return words.slice(0, 2).join(' ');
	}

	function endpointTextForSide(item, side) {
		// Endpoint labels should reflect the underlying numeric reversal logic in `computeDimensionViz`,
		// but only swap text when `item.reverse === true`.
		const dimId = viz?.dim?.id;

		// 1) If the item has statement_values (id 27), use those min/max.
		const itemSv = item?.statement_values;
		let raw =
			!isBlank(itemSv?.[side]) ? itemSv?.[side] : !isBlank(viz?.dim?.statement_values?.[side]) ? viz?.dim?.statement_values?.[side] : undefined;

		// 2) Fallback: use whatever dimension-level labels were computed.
		if (isBlank(raw)) raw = side === 'min' ? viz?.labels?.item?.left : viz?.labels?.item?.right;

		const str = isBlank(raw) ? '' : String(raw);
		// Truncate endpoints ONLY for dimension id 27.
		return dimId === 27 ? truncateFirstTwoWords(str) : str;
	}

	function aggregateScaleLabels() {
		return {
			min: String(viz?.labels?.aggregate?.left ?? ''),
			max: String(viz?.labels?.aggregate?.right ?? '')
		};
	}

	function scaleTextForValue(value, scaleTexts, min, max, reverse = false) {
		if (!Array.isArray(scaleTexts) || scaleTexts.length === 0) return '';
		if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return '';
		const clamped = Math.max(min, Math.min(max, value));
		let bin = Math.floor(clamped);
		if (reverse) {
			bin = min + max - bin;
		}
		const idx = Math.max(0, Math.min(scaleTexts.length - 1, bin - min));
		return String(scaleTexts[idx] ?? '');
	}

	/** Pill fills aggregate row (no inset so it stays visually filled). */
	/**
	 * Keep the pill visually filled across the whole row height.
	 */
	const aggBarStrokePadY = 0.5;
	const aggBarStrokeTop = $derived(margin.top + aggBarStrokePadY);
	const aggBarStrokeHeight = $derived(ROW_AGG_HEIGHT - 2 * aggBarStrokePadY);

	const xScales = $derived.by(() => {
		if (!viz) return [];
		const scales = [
			d3.scaleLinear().domain(viz.aggregateExtent).range([0, innerWidth])
		];
		for (let i = 0; i < viz.dim.items.length; i++) {
			scales.push(d3.scaleLinear().domain(viz.itemExtents[i]).range([0, innerWidth]));
		}
		return scales;
	});

	const valueColorScale = $derived.by(() => {
		const minRaw = viz?.dim?.scale?.min;
		const maxRaw = viz?.dim?.scale?.max;
		const min = Number.isFinite(minRaw) ? Math.floor(minRaw) : 1;
		const max = Number.isFinite(maxRaw) ? Math.floor(maxRaw) : 6;
		const span = Math.max(1, max - min + 1);
		let palette;

		// Special mapping requested for 1-4 scales:
		// take colors from 1-10 palette bins [2, 4, 7, 9].
		if (min === 1 && max === 4) {
			palette = [
				VALUE_PALETTE_1_TO_10[1],
				VALUE_PALETTE_1_TO_10[3],
				VALUE_PALETTE_1_TO_10[6],
				VALUE_PALETTE_1_TO_10[8]
			];
		} else {
			const basePalette = max <= 6 ? VALUE_PALETTE_1_TO_6 : VALUE_PALETTE_1_TO_10;
			palette = basePalette.slice(0, span);
		}
		const fallback = palette[0] ?? VALUE_PALETTE_1_TO_6[0];

		return (value) => {
			if (!Number.isFinite(value)) return fallback;
			const clamped = Math.max(min, Math.min(max, value));
			const binned = Math.floor(clamped);
			const index = Math.max(0, Math.min(span - 1, binned - min));
			return palette[index] ?? fallback;
		};
	});

	/** Radius: fill pill height (vertically, like the reference mock). */
	const aggDotR = $derived.by(() => {
		if (!viz || !xScales.length || !viz.modelSeries.length) return 8;
		const verticalMax = aggBarStrokeHeight / 2 - 3;
		return Math.max(5, Math.min(verticalMax, 20));
	});

	/**
	 * @param {{ fundModel: string, itemMeans: (number|null)[], aggregate: number }} m
	 * @returns {[number, number][]}
	 */
	function modelPoints(m) {
		if (!viz || !xScales.length) return [];
		const ys = rowCentersY;
		/** @type {[number, number][]} */
		const pts = [[xScales[0](m.aggregate), ys[0]]];
		for (let i = 0; i < m.itemMeans.length; i++) {
			const v = m.itemMeans[i];
			if (v === null || v === undefined || Number.isNaN(v)) continue;
			pts.push([xScales[i + 1](v), ys[i + 1]]);
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

	function setHover(event, model, value, responseText) {
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
	<p class="text-sm text-slate-500">No data for this dimension.</p>
{:else}
	<div class="chart-wrap" style="width: {width}px; height: {height}px;">
		<svg
			width={width}
			height={height}
			/* Height is controlled by the computed `height` attribute to preserve row centers. */
			/* Avoid flex cross-axis stretching which would rescale our row geometry. */
			style="overflow: visible"
			class="block max-w-full shrink-0 self-start"
			role="img"
		>
			<title>Model positions by dimension aggregate and statements</title>
			<rect x="0" y="0" width={width} height={height} fill={PANEL_BG} />

			<g transform="translate({margin.side},0)" style="overflow: visible">
			<rect
				x="0"
				y={aggBarStrokeTop + aggBarStrokeHeight /4}
				width={innerWidth}
				height={aggBarStrokeHeight /2}
				rx={aggBarStrokeHeight /4}
				fill={AGG_TRACK_FILL}
				stroke={AGG_TRACK_STROKE}
				stroke-width="0"
			/>
			
			<text
				x={-10}
				y={rowCentersY[0]}
				fill="#1c1917"
				font-size="11"
				font-weight="600"
				text-anchor="end"
				dominant-baseline="middle"
			>
				{viz.labels.aggregate.left}
			</text>
			<text
				x={innerWidth + 10}
				y={rowCentersY[0]}
				fill="#1c1917"
				font-size="11"
				font-weight="600"
				text-anchor="start"
				dominant-baseline="middle"
			>
				{viz.labels.aggregate.right}
			</text>

			{#each viz.dim.items as item, ri (item.item_id)}
				/**
				 * Axis guides align to the statement-row top edge (match right ContextPanel card top border).
				 * We keep dot/line positions for the model curves based on row centers separately.
				 */
				{@const yi = rowCentersY[ri + 1]}
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
				{@const rAgg = aggDotR}
				{@const rStmt = selected ? 9 : 7}
				{@const aggregateX = xScales[0](m.aggregate)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<circle
					cx={aggregateX}
					cy={rowCentersY[0]}
					r={rAgg}
					fill={valueColorScale(m.aggregate)}
					stroke={selected ? '#0a0a0a' : '#f5f5f4'}
					// Keep the selected emphasis ring readable without obscuring the fill.
					stroke-width="2"
					stroke-opacity={selected ? 1 : 0.85}
					opacity={1}
					onmouseenter={(event) => {
						const min = Number(viz?.dim?.scale?.min);
						const max = Number(viz?.dim?.scale?.max);
						const responseText =
							scaleTextForValue(m.aggregate, viz?.dim?.statement_scale, min, max, false) ||
							aggregateScaleLabels().max;
						setHover(event, m.fundModel, m.aggregate, responseText);
					}}
					onmousemove={(event) => {
						const min = Number(viz?.dim?.scale?.min);
						const max = Number(viz?.dim?.scale?.max);
						const responseText =
							scaleTextForValue(m.aggregate, viz?.dim?.statement_scale, min, max, false) ||
							aggregateScaleLabels().max;
						setHover(event, m.fundModel, m.aggregate, responseText);
					}}
					onmouseleave={clearHover}
				/>
				{#each m.itemMeans as value, itemIndex (itemIndex)}
					{#if value !== null && value !== undefined && !Number.isNaN(value)}
						{@const ptX = xScales[itemIndex + 1](value)}
						{@const item = viz.dim.items[itemIndex]}
						{@const min = Number(viz?.dim?.scale?.min)}
						{@const max = Number(viz?.dim?.scale?.max)}
						{@const itemScaleTexts = Array.isArray(item?.statement_scale) && item.statement_scale.length
							? item.statement_scale
							: viz?.dim?.statement_scale}
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
							cy={rowCentersY[itemIndex + 1]}
							r={rStmt}
							fill={valueColorScale(value)}
							stroke={selected ? '#0a0a0a' : 'transparent'}
							stroke-width={selected ? 2 : 0}
							stroke-opacity={selected ? 1 : 0.85}
							opacity={1}
							onmouseenter={(event) => setHover(event, m.fundModel, value, responseText)}
							onmousemove={(event) => setHover(event, m.fundModel, value, responseText)}
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

	.tooltip-row {
		color: #57534e;
	}
</style>
