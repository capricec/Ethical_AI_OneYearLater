<script>
	import * as d3 from 'd3';
	import {
		CHART_MARGIN_TOP,
		CHART_MARGIN_BOTTOM,
		CHART_SIDE_GUTTER,
		ROW_ITEM_HEIGHT
	} from '$lib/viz/dimensionChartLayout.js';
	import { scaleTextForValue } from '$lib/viz/valuePalette.js';
	import { modelColor } from '$lib/viz/modelColors.js';
	import VizTooltip from '$lib/ui/VizTooltip.svelte';

	const PANEL_BG = '#ebebeb';

	const ITEM_LINE_STROKE = '#cfcfcf';
	const SCALE_TICK_STROKE = '#78716c';
	const TICK_HALF_HEIGHT = 30;
	const GREY_SPIKE_FILL = '#cecece';
	const spikeHalfHSelected = 25;
	const spikeHalfHOther = 25;
const DETAIL_TOP_PAD = ROW_ITEM_HEIGHT + 40;
const DETAIL_ROW_H = 80;

	/**
	 * @typedef {object} Viz
	 * @property {{ items: object[] }} dim
	 * @property {{ fundModel: string, itemMeans: (number|null)[] }[]} modelSeries
	 * @property {[number, number][]} itemExtents
	 * @property {{ aggregate: { left: string, right: string }, item: { left: string, right: string } }} labels
	 */

	/** @type {{ width: number, viz: Viz, selectedModel: (string|null), selectedStatementId?: (string|null), rowHeights?: number[] }} */
	let { width, viz, selectedModel, selectedStatementId = null, rowHeights = [] } = $props();
	/** @type {{ x: number, y: number, model: string, responseText: string, responseLabel?: string, percentOfTotalText?: string } | null} */
	let tooltip = $state(null);

	const margin = { top: CHART_MARGIN_TOP, bottom: CHART_MARGIN_BOTTOM, side: CHART_SIDE_GUTTER };
	const TOOLTIP_WIDTH = 170;
	const TOOLTIP_HEIGHT = 56;
	const TOOLTIP_PADDING = 8;

	const height = $derived(
		viz
			? CHART_MARGIN_TOP +
				CHART_MARGIN_BOTTOM +
				(rowHeights?.length === viz.dim.items.length
					? rowHeights.reduce((acc, h) => acc + (Number.isFinite(h) ? h : ROW_ITEM_HEIGHT), 0)
					: viz.dim.items.length * ROW_ITEM_HEIGHT)
			: 120
	);

	const innerWidth = $derived(Math.max(120, width - margin.side * 2));
	const activeModel = $derived(selectedModel);

	const rowCentersY = $derived.by(() => {
		if (!viz) return [];
		const ys = [];
		let y = margin.top;
		for (let i = 0; i < viz.dim.items.length; i++) {
			const h = rowHeights?.[i] ?? ROW_ITEM_HEIGHT;
		// Keep bump marks top-aligned even when a row expands.
		ys.push(y + ROW_ITEM_HEIGHT / 2);
			y += h;
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

	/** Pixel x of domain midpoint per row (scale center tick). */
	const rowTickX = $derived.by(() => {
		if (!viz || !xScales.length) return [];
		const xs = [];
		for (let i = 0; i < viz.dim.items.length; i++) {
			const ext = viz.itemExtents[i] ?? [0, 1];
			xs.push(xScales[i]((ext[0] + ext[1]) / 2));
		}
		return xs;
	});



	function spikePathD(baseX, tipX, y, halfH) {
		const yTop = y - halfH;
		const yBot = y + halfH;
		return `M ${baseX} ${yTop} L ${tipX} ${y} L ${baseX} ${yBot} Z`;
	}

	function spikeBandPathD(baseX, outerTipX, innerTipX, y, halfH) {
		const yTop = y - halfH;
		const yBot = y + halfH;
		return `M ${baseX} ${yTop} L ${outerTipX} ${y} L ${baseX} ${yBot} Z M ${baseX} ${yTop} L ${innerTipX} ${y} L ${baseX} ${yBot} Z`;
	}

	const spikeRenderRows = $derived.by(() => {
		if (!viz || !xScales.length || !rowCentersY.length || !rowTickX.length) return [];
		/** @type {{ rowIndex: number, y: number, baseX: number, sharedTip: number|null, layers: { key: string, model: string, pathD: string, isBand: boolean, responseText: string, area: number }[] }[]} */
		const out = [];

		for (let rowIndex = 0; rowIndex < viz.dim.items.length; rowIndex++) {
			const y = rowCentersY[rowIndex];
			const baseX = rowTickX[rowIndex] ?? innerWidth / 2;
			/** @type {{ model: string, tipX: number, responseText: string }[]} */
			const spikes = [];
			for (const ms of viz.modelSeries) {
				const value = ms.itemMeans[rowIndex];
				if (value === null || value === undefined || Number.isNaN(value)) continue;
				const item = viz.dim.items[rowIndex];
				const min = Number(item?.scaleMin);
				const max = Number(item?.scaleMax);
				const itemScaleTexts =
					Array.isArray(item?.statement_scale) && item.statement_scale.length ? item.statement_scale : [];
				const responseText = scaleTextForValue(
					value,
					itemScaleTexts,
					min,
					max,
					Boolean(item?.reverse)
				);
				spikes.push({
					model: ms.fundModel,
					tipX: xScales[rowIndex](value),
					responseText: responseText || ''
				});
			}
			if (!spikes.length) continue;

			const allRight = spikes.every((s) => s.tipX >= baseX - 1e-6);
			const allLeft = spikes.every((s) => s.tipX <= baseX + 1e-6);
			let sharedTip = null;
			if (allRight) sharedTip = Math.min(...spikes.map((s) => s.tipX));
			else if (allLeft) sharedTip = Math.max(...spikes.map((s) => s.tipX));

			/** @type {{ key: string, model: string, pathD: string, isBand: boolean, responseText: string, area: number }[]} */
			const layers = [];
			for (const s of spikes) {
				if (sharedTip !== null) {
					const area = Math.abs(s.tipX - sharedTip);
					if (area <= 1e-6) continue;
					const outerTip = allRight ? Math.max(s.tipX, sharedTip) : Math.min(s.tipX, sharedTip);
					const innerTip = allRight ? Math.min(s.tipX, sharedTip) : Math.max(s.tipX, sharedTip);
					layers.push({
						key: `band-${rowIndex}-${s.model}`,
						model: s.model,
						pathD: spikeBandPathD(baseX, outerTip, innerTip, y, spikeHalfHOther),
						isBand: true,
						responseText: s.responseText,
						area
					});
				} else {
					layers.push({
						key: `full-${rowIndex}-${s.model}`,
						model: s.model,
						pathD: spikePathD(baseX, s.tipX, y, spikeHalfHOther),
						isBand: false,
						responseText: s.responseText,
						area: Math.abs(s.tipX - baseX)
					});
				}
			}
			layers.sort((a, b) => b.area - a.area);
			out.push({ rowIndex, y, baseX, sharedTip, layers });
		}
		return out;
	});

const rowBounds = $derived.by(() => {
	if (!viz) return [];
	/** @type {{ top: number, height: number, center: number }[]} */
	const out = [];
	let y = margin.top;
	for (let i = 0; i < viz.dim.items.length; i++) {
		const h = rowHeights?.[i] ?? ROW_ITEM_HEIGHT;
		out.push({ top: y, height: h, center: y + h / 2 });
		y += h;
	}
	return out;
});

const selectedRowIndex = $derived.by(() => {
	if (!viz || !selectedStatementId) return -1;
	return viz.dim.items.findIndex((it) => it.item_id === selectedStatementId);
});

const selectedDetail = $derived.by(() => {
	if (!viz || selectedRowIndex < 0 || !rowBounds[selectedRowIndex]) return null;
	const bounds = rowBounds[selectedRowIndex];
	const chartX0 = 0;
	const chartW = Math.max(120, innerWidth);
	const chartX1 = chartX0 + chartW;
	const centerX = rowTickX[selectedRowIndex] ?? chartX0 + chartW / 2;
	const maxRows = Math.max(1, Math.floor((bounds.height - DETAIL_TOP_PAD - 10) / DETAIL_ROW_H));
	const rows = viz.modelSeries.slice(0, maxRows).map((ms, idx) => {
		const bins = Array.isArray(ms.itemDistributions?.[selectedRowIndex])
			? ms.itemDistributions[selectedRowIndex]
			: [];
		return {
			model: ms.fundModel,
			color: modelColor(ms.fundModel),
			bins,
			y: bounds.top + DETAIL_TOP_PAD + idx * DETAIL_ROW_H
		};
	});
	return { chartX0, chartW, chartX1, centerX, rows };
});

	function clampTooltipPosition(rawX, rawY) {
		const maxX = Math.max(TOOLTIP_PADDING, width - TOOLTIP_WIDTH - TOOLTIP_PADDING);
		const maxY = Math.max(TOOLTIP_PADDING, height - TOOLTIP_HEIGHT - TOOLTIP_PADDING);
		return {
			x: Math.max(TOOLTIP_PADDING, Math.min(maxX, rawX)),
			y: Math.max(TOOLTIP_PADDING, Math.min(maxY, rawY))
		};
	}

	function setHover(event, model, responseText) {
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
		tooltip = null;
	}

	function heatmapResponseTextForBin(item, binIndex) {
		const scaleTexts = Array.isArray(item?.statement_scale) ? item.statement_scale : [];
		if (scaleTexts.length) {
			const idx = Math.max(0, Math.min(scaleTexts.length - 1, binIndex));
			return String(scaleTexts[idx] ?? '');
		}
		const min = Number(item?.scaleMin);
		return Number.isFinite(min) ? `${Math.round(min) + binIndex}` : `${binIndex + 1}`;
	}

	function setHeatHover(event, model, responseText, percent) {
		const rect = event.currentTarget?.ownerSVGElement?.getBoundingClientRect();
		const localX = rect ? event.clientX - rect.left : 0;
		const localY = rect ? event.clientY - rect.top : 0;
		const pos = clampTooltipPosition(localX + 12, localY - TOOLTIP_HEIGHT - 8);
		tooltip = {
			x: pos.x,
			y: pos.y,
			model,
			responseText,
			responseLabel: 'Response',
			percentOfTotalText: `${(percent * 100).toFixed(1)}%`
		};
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
					{@const isSelectedRow = selectedStatementId === item.item_id}
					{@const isDimmed = selectedStatementId && !isSelectedRow}
					{@const yi = rowCentersY[ri]}
					{@const tickX = rowTickX[ri] ?? innerWidth / 2}
					{@const baseMin = endpointTextForSide(item, 'min')}
					{@const baseMax = endpointTextForSide(item, 'max')}
					{@const rowLeft = item?.reverse ? baseMax : baseMin}
					{@const rowRight = item?.reverse ? baseMin : baseMax}
					<line
						x1="0"
						x2={innerWidth}
						y1={yi}
						y2={yi}
						stroke={ITEM_LINE_STROKE}
						stroke-width="1"
						opacity={isDimmed ? 0.5 : 1}
					/>
					<line
						x1={tickX}
						x2={tickX}
						y1={yi - TICK_HALF_HEIGHT}
						y2={yi + TICK_HALF_HEIGHT}
						stroke={SCALE_TICK_STROKE}
						stroke-width="1.5"
						opacity={isDimmed ? 0.5 : 1}
					/>
					<text
						x={-10}
						y={yi}
						fill="#57534e"
						font-size="11"
						font-weight="400"
						text-anchor="end"
						dominant-baseline="middle"
						opacity={isDimmed ? 0.5 : 1}>
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
						opacity={isDimmed ? 0.5 : 1}>
						{rowRight}
					</text>
				{/each}

				{#each spikeRenderRows as row (`row-${row.rowIndex}`)}
					{@const isSelectedRow = selectedStatementId
						? viz.dim.items[row.rowIndex]?.item_id === selectedStatementId
						: false}
					{@const rowOpacity = selectedStatementId && !isSelectedRow ? 0.5 : 1}
					{#if row.sharedTip !== null}
						<path
							d={spikePathD(row.baseX, row.sharedTip, row.y, spikeHalfHSelected)}
							fill={GREY_SPIKE_FILL}
							fill-opacity={0.78 * rowOpacity}
						/>
					{/if}

					{@const visibleLayers = selectedModel
						? row.layers.filter((layer) => layer.model === selectedModel)
						: row.layers}
					{#each [...visibleLayers].sort((a, b) => {
						const aSel = a.model === activeModel;
						const bSel = b.model === activeModel;
						if (aSel && !bSel) return 1;
						if (!aSel && bSel) return -1;
						return 0;
					}) as layer (layer.key)}
						{@const selected = layer.model === activeModel}
						<path
							d={layer.pathD}
							fill={modelColor(layer.model)}
							fill-rule={layer.isBand ? 'evenodd' : 'nonzero'}
							stroke="none"
							stroke-width="0"
							opacity={(selected ? 1 : 0.9) * rowOpacity}
						/>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<path
							d={layer.pathD}
							fill="transparent"
							stroke="transparent"
							stroke-width="8"
							stroke-linejoin="round"
							onmouseenter={(event) => setHover(event, layer.model, layer.responseText)}
							onmousemove={(event) => setHover(event, layer.model, layer.responseText)}
							onmouseleave={clearHover}
						/>
					{/each}
				{/each}

				{#if selectedDetail}
					{#each selectedDetail.rows as d (`detail-${d.model}`)}
						{@const selectedItem = viz.dim.items[selectedRowIndex]}
						{@const nBins = Math.max(1, d.bins.length)}
						{@const center = (nBins - 1) / 2}
						{@const barY = d.y}
						{@const barH = 30}
						{@const safeTotal = d.bins.reduce((a, b) => a + Math.max(0, b || 0), 0) || 1}
						{@const binsNorm = d.bins.map((v) => Math.max(0, v || 0) / safeTotal)}
						{@const leftSpan = Math.max(0, selectedDetail.centerX - selectedDetail.chartX0)}
						{@const rightSpan = Math.max(0, selectedDetail.chartX1 - selectedDetail.centerX)}
						{#each d.bins as rawPct, bi (`${d.model}-${bi}`)}
							{@const pct = Math.max(0, rawPct || 0) / safeTotal}
							{@const isLeft = bi <= center}
							{@const leftOffsetPct = isLeft
								? binsNorm
									.slice(bi + 1, Math.floor(center) + 1)
									.reduce((a, b) => a + b, 0)
								: 0}
							{@const rightStart = Math.floor(center) + 1}
							{@const rightOffsetPct = !isLeft
								? binsNorm.slice(rightStart, bi).reduce((a, b) => a + b, 0)
								: 0}
							{@const sidePct = pct}
							{@const sideOffsetPct = isLeft ? leftOffsetPct : rightOffsetPct}
							{@const rawX0 = isLeft
								? selectedDetail.centerX - (sideOffsetPct + sidePct) * leftSpan
								: selectedDetail.centerX + sideOffsetPct * rightSpan}
							{@const rawX1 = isLeft
								? selectedDetail.centerX - sideOffsetPct * leftSpan
								: selectedDetail.centerX + (sideOffsetPct + sidePct) * rightSpan}
							{@const x0 = Math.round(rawX0)}
							{@const x1 = Math.round(rawX1)}
							{@const x = Math.min(x0, x1)}
							{@const w = Math.max(0, Math.abs(x1 - x0))}
							{@const centerOffset = nBins % 2 === 0 ? 0.5 : 0}
							{@const distFromCenter = Math.max(0, Math.abs(bi - center) - centerOffset)}
							{@const maxDistFromCenter = Math.max(0, center - centerOffset)}
							{@const alpha = maxDistFromCenter > 0 ? 0.2 + 0.8 * (distFromCenter / maxDistFromCenter) : 1}
							{@const responseText = heatmapResponseTextForBin(selectedItem, bi)}
							{#if w > 0.75}
								<rect
									x={x}
									y={barY}
									width={w}
									height={barH}
									fill={d.color}
									fill-opacity={alpha}
									rx="0"
									shape-rendering="crispEdges"
									role="presentation"
									onmouseenter={(event) => setHeatHover(event, d.model, responseText, pct)}
									onmousemove={(event) => setHeatHover(event, d.model, responseText, pct)}
									onmouseleave={clearHover}
								/>
							{/if}
						{/each}
						<line
							x1={selectedDetail.centerX}
							x2={selectedDetail.centerX}
							y1={barY - 2}
							y2={barY + barH + 2}
							stroke="#64748b"
							stroke-width="1"
							stroke-opacity="0.6"
						/>
					{/each}
				{/if}
			</g>
		</svg>
		{#if tooltip}
			<VizTooltip
				x={tooltip.x}
				y={tooltip.y}
				maxWidth={170}
				model={tooltip.model}
				responseText={tooltip.responseText}
				responseLabel={tooltip.responseLabel ?? 'Average response'}
				percentOfTotalText={tooltip.percentOfTotalText ?? ''}
			/>
		{/if}
	</div>
{/if}

<style>
	.chart-wrap {
		position: relative;
	}
</style>
