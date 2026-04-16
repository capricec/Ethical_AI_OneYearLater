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
	import { compiled } from '$lib/data/dataset.js';
	import { dailySeriesForStatementModel } from '$lib/data/statementDailySeries.js';
import {
		STATEMENT_DETAIL_AGGREGATE_MODE,
		DOT_STRIP_CONFIG,
		SINGLE_MODEL_DOT_RADIUS_PX,
		SINGLE_MODEL_JITTER_SCALE_UNITS
	} from '$lib/viz/statementAggregateDetailVizConfig.js';

	const PANEL_BG = '#ffffff';

	const ITEM_LINE_STROKE = '#cfcfcf';
	const SCALE_TICK_STROKE = '#78716c';
	const TICK_HALF_HEIGHT = 30;
	/** Inner-SVG x for model names beside heatmap/dot rows (text-anchor end). */
	const DETAIL_MODEL_LABEL_X = -138;
	const spikeHalfHOther = 25;
	const DETAIL_TOP_PAD = ROW_ITEM_HEIGHT + 40;
	/** Vertical spacing between model heatmap/dot rows (page passes row height to match). */
	const DETAIL_ROW_H = 100;
	/** Must match heatmap / aggregate dot row strip (`barH` in template). */
	const AGGREGATE_DETAIL_BAR_H = 30;
	/** Matches `barY ± 2` vertical guide lines in aggregate views. */
	const AGGREGATE_GUIDE_LINE_INSET = 2;

	/**
	 * @typedef {object} Viz
	 * @property {{ items: object[] }} dim
	 * @property {{ fundModel: string, itemMeans: (number|null)[] }[]} modelSeries
	 * @property {[number, number][]} itemExtents
	 * @property {{ aggregate: { left: string, right: string }, item: { left: string, right: string } }} labels
	 */

	/** @type {{ width: number, viz: Viz, selectedModel: (string|null), selectedStatementId?: (string|null), rowHeights?: number[], highlightSubscaleKey?: (string|null) }} */
	let {
		width,
		viz,
		selectedModel,
		selectedStatementId = null,
		rowHeights = [],
		highlightSubscaleKey = null
	} = $props();

	const HIGHLIGHT_DIM_OPACITY = 0;

	/** @param {unknown} k */
	function normSubscaleKey(k) {
		const s = String(k ?? '').trim();
		return s || '__none__';
	}

	const subscaleHighlightLocked = $derived(
		highlightSubscaleKey != null && String(highlightSubscaleKey).trim() !== ''
	);

	/**
	 * @param {object} item
	 * @param {number} baseOpacity
	 */
	function opacityForSubscaleRow(item, baseOpacity) {
		if (!subscaleHighlightLocked) return baseOpacity;
		return normSubscaleKey(item?.subscaleKey) === normSubscaleKey(highlightSubscaleKey)
			? baseOpacity
			: baseOpacity * HIGHLIGHT_DIM_OPACITY;
	}
	/** @type {{ x: number, y: number, model: string, responseText: string, responseLabel?: string, percentOfTotalText?: string, metaLine?: string } | null} */
	let tooltip = $state(null);

	/** Narrow viewports: smaller side gutter so the scale isn’t crushed; labels sit just inside the gutter. */
	const isCompactWidth = $derived(width < 768);
	const sideGutter = $derived(
		isCompactWidth
			? Math.max(32, Math.min(80, Math.round(width * 0.14)))
			: CHART_SIDE_GUTTER
	);
	const margin = $derived({
		top: CHART_MARGIN_TOP,
		bottom: CHART_MARGIN_BOTTOM,
		side: sideGutter
	});
	/**
	 * Vertical position of the bump row midline (spike + horizontal axis). Single-row compact
	 * statement view uses a higher line so the spike sits closer to the top of the chart.
	 */
	const bumpRowCenterOffset = $derived(
		isCompactWidth && viz && viz.dim.items.length === 1
			? Math.round(ROW_ITEM_HEIGHT * 0.32)
			: ROW_ITEM_HEIGHT / 2
	);
	/**
	 * Compact: heatmaps / timeline start below under-plot axis labels (hanging).
	 * Trailing constant is clearance under caption glyphs + extra gap before first detail row.
	 */
	const detailTopPad = $derived(
		isCompactWidth ? bumpRowCenterOffset + TICK_HALF_HEIGHT + 3 + 24 : DETAIL_TOP_PAD
	);
	const detailRowH = $derived(isCompactWidth ? 54 : DETAIL_ROW_H);
	const modelLabelX = $derived(isCompactWidth ? -4 : DETAIL_MODEL_LABEL_X);
	const detailModelFontWeight = $derived(isCompactWidth ? '500' : '600');
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

	const innerWidth = $derived(Math.max(80, width - margin.side * 2));
	const activeModel = $derived(selectedModel);

	const rowCentersY = $derived.by(() => {
		if (!viz) return [];
		const ys = [];
		let y = margin.top;
		for (let i = 0; i < viz.dim.items.length; i++) {
			const h = rowHeights?.[i] ?? ROW_ITEM_HEIGHT;
			// Keep bump marks top-aligned even when a row expands.
			ys.push(y + bumpRowCenterOffset);
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

			/** One solid triangle from center to tip — no multi-model band cutouts. */
			if (selectedModel) {
				const s = spikes.find((sp) => sp.model === selectedModel);
				if (!s) continue;
				const layers = [
					{
						key: `solo-${rowIndex}-${s.model}`,
						model: s.model,
						pathD: spikePathD(baseX, s.tipX, y, spikeHalfHOther),
						isBand: false,
						responseText: s.responseText,
						area: Math.abs(s.tipX - baseX)
					}
				];
				out.push({ rowIndex, y, baseX, sharedTip: null, layers });
				continue;
			}

			const allRight = spikes.every((s) => s.tipX >= baseX - 1e-6);
			const allLeft = spikes.every((s) => s.tipX <= baseX + 1e-6);
			let sharedTip = null;
			if (allRight) sharedTip = Math.min(...spikes.map((s) => s.tipX));
			else if (allLeft) sharedTip = Math.max(...spikes.map((s) => s.tipX));

			/** @type {{ key: string, model: string, pathD: string, isBand: boolean, responseText: string, area: number }[]} */
			const layers = [];
			for (const s of spikes) {
				if (sharedTip !== null) {
					const gap = Math.abs(s.tipX - sharedTip);
					/** Innermost model (tip at sharedTip): band has zero width — use full spike from center to tip so that wedge isn’t left unfilled and the model isn’t skipped. */
					if (gap <= 1e-6) {
						layers.push({
							key: `inner-${rowIndex}-${s.model}`,
							model: s.model,
							pathD: spikePathD(baseX, s.tipX, y, spikeHalfHOther),
							isBand: false,
							responseText: s.responseText,
							area: Math.abs(s.tipX - baseX)
						});
					} else {
						const outerTip = allRight ? Math.max(s.tipX, sharedTip) : Math.min(s.tipX, sharedTip);
						const innerTip = allRight ? Math.min(s.tipX, sharedTip) : Math.max(s.tipX, sharedTip);
						layers.push({
							key: `band-${rowIndex}-${s.model}`,
							model: s.model,
							pathD: spikeBandPathD(baseX, outerTip, innerTip, y, spikeHalfHOther),
							isBand: true,
							responseText: s.responseText,
							area: gap
						});
					}
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
	const maxRows = Math.max(
		1,
		Math.min(
			viz.modelSeries.length,
			Math.floor(
				(bounds.height - detailTopPad - AGGREGATE_DETAIL_BAR_H - 4) / detailRowH
			) + 1
		)
	);
	const rows = viz.modelSeries.slice(0, maxRows).map((ms, idx) => {
		const bins = Array.isArray(ms.itemDistributions?.[selectedRowIndex])
			? ms.itemDistributions[selectedRowIndex]
			: [];
		return {
			model: ms.fundModel,
			color: modelColor(ms.fundModel),
			bins,
			y: bounds.top + detailTopPad + idx * detailRowH
		};
	});
	return { chartX0, chartW, chartX1, centerX, rows };
});

	const drillDownLayout = $derived.by(() => {
		if (!viz || !selectedStatementId || !selectedModel || selectedRowIndex < 0) return null;
		if (!rowBounds[selectedRowIndex] || !xScales[selectedRowIndex]) return null;
		const item = viz.dim.items[selectedRowIndex];
		const series = dailySeriesForStatementModel(
			compiled,
			item.dimensionId,
			item,
			selectedModel
		);
		if (!series.length) return null;
		const bounds = rowBounds[selectedRowIndex];
		const xScale = xScales[selectedRowIndex];
		const centerX = rowTickX[selectedRowIndex] ?? innerWidth / 2;
		const maxRows = Math.max(
			1,
			Math.min(
				viz.modelSeries.length,
				Math.floor(
					(bounds.height - detailTopPad - AGGREGATE_DETAIL_BAR_H - 4) / detailRowH
				) + 1
			)
		);
		const yTop =
			bounds.top + detailTopPad - AGGREGATE_GUIDE_LINE_INSET;
		const yBottom =
			bounds.top +
			detailTopPad +
			(maxRows - 1) * detailRowH +
			AGGREGATE_DETAIL_BAR_H +
			AGGREGATE_GUIDE_LINE_INSET;
		const h = Math.max(40, yBottom - yTop);
		const n = series.length;
		const smin = Number(item.scaleMin);
		const smax = Number(item.scaleMax);
		const nBins = Math.max(
			1,
			Number.isFinite(smin) && Number.isFinite(smax)
				? Math.floor(smax) - Math.floor(smin) + 1
				: 1
		);
		const lineHue = modelColor(selectedModel);
		const ext = viz.itemExtents[selectedRowIndex] ?? [0, 1];
		const vMin = Math.min(ext[0], ext[1]);
		const vMax = Math.max(ext[0], ext[1]);

		// Time domain for vertical axis: at least Mar 1 2025 → Mar 1 2026.
		const seriesTimes = series.map((d) => {
			const dt = timelineDate(d.date);
			return dt ? dt.getTime() : NaN;
		});
		let tMin = Infinity;
		let tMax = -Infinity;
		for (const t of seriesTimes) {
			if (!Number.isFinite(t)) continue;
			if (t < tMin) tMin = t;
			if (t > tMax) tMax = t;
		}
		const tAnchorStart = timelineDate('2025-03-01')?.getTime() ?? NaN;
		const tAnchorEnd = timelineDate('2026-03-01')?.getTime() ?? NaN;
		if (Number.isFinite(tAnchorStart)) tMin = Math.min(tMin, tAnchorStart);
		if (Number.isFinite(tAnchorEnd)) tMax = Math.max(tMax, tAnchorEnd);
		if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) {
			tMin = 0;
			tMax = 1;
		}

		function yForTimeOnAxis(tMs, fallbackIndex) {
			if (!Number.isFinite(tMs)) {
				// Fall back to index-based placement when date is invalid.
				const fracIdx = n <= 1 ? 0.5 : fallbackIndex / Math.max(1, n - 1);
				return yTop + fracIdx * h;
			}
			const clamped = Math.max(tMin, Math.min(tMax, tMs));
			const frac = (clamped - tMin) / (tMax - tMin || 1);
			return yTop + frac * h;
		}

		const points = series.map((d, i) => {
			const py = yForTimeOnAxis(seriesTimes[i], i);
			const delta = detJitter(
				seedFrom(selectedModel, d.date, i),
				SINGLE_MODEL_JITTER_SCALE_UNITS
			);
			const v = Math.min(vMax, Math.max(vMin, d.value + delta));
			const pxRaw = xScale(v);
			const px = Math.max(
				SINGLE_MODEL_DOT_RADIUS_PX,
				Math.min(innerWidth - SINGLE_MODEL_DOT_RADIUS_PX, pxRaw)
			);
			const bi = binIndexForValue(d.value, smin, smax);
			const fillOpacity = heatmapAlphaForBinIndex(nBins, bi);
			return { date: d.date, value: d.value, model: d.model, px, py, fillOpacity };
		});

		/**
		 * Dots use y = f(index), not literal calendar time. Place a calendar instant on that axis by
		 * linear interpolation in time between consecutive samples, then map fractional index → y.
		 * (So Mar 2025 / Mar 2026 always show, even with zero observations in March.)
		 */
		/** @param {number} tMs */
		function yForCalendarOnDotAxis(tMs) {
			return yForTimeOnAxis(tMs, 0.5 * (n - 1));
		}

		/** @type {{ y: number, label: string }[]} */
		const monthMarkers = [];
		for (const iso of ['2025-03-01', '2026-03-01']) {
			const dt = timelineDate(iso);
			if (!dt) continue;
			monthMarkers.push({
				y: yForCalendarOnDotAxis(dt.getTime()),
				label: dt.toLocaleString('en-US', { month: 'short', year: 'numeric' })
			});
		}
		monthMarkers.sort((a, b) => a.y - b.y);

		/** Model-version markers: first sample and any time `model` changes. */
		/** @type {{ y: number, label: string }[]} */
		const modelMarkers = [];
		let lastModel = /** @type {string | null} */ (null);
		for (let i = 0; i < n; i++) {
			const m = String(series[i].model ?? '').trim();
			if (!m) continue;
			if (lastModel === null || m !== lastModel) {
				const t = seriesTimes[i];
				const y = yForTimeOnAxis(t, i);
				modelMarkers.push({ y, label: m });
				lastModel = m;
			}
		}

		return {
			points,
			centerX,
			yTop,
			yBottom,
			lineHue,
			radiusPx: SINGLE_MODEL_DOT_RADIUS_PX,
			monthMarkers,
			modelMarkers
		};
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

	/** @param {string} dateStr */
	function timelineDate(/** @type {string} */ dateStr) {
		const s = String(dateStr ?? '').trim();
		if (!s) return null;
		const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(s);
		const d = new Date(isoDay ? `${s}T12:00:00` : s);
		return Number.isNaN(d.getTime()) ? null : d;
	}

	/** Matches heatmap rect opacity: strongest at scale extremes, ~0.2 at center bin(s). */
	function heatmapAlphaForBinIndex(nBins, bi) {
		const center = (nBins - 1) / 2;
		const centerOffset = nBins % 2 === 0 ? 0.5 : 0;
		const distFromCenter = Math.max(0, Math.abs(bi - center) - centerOffset);
		const maxDistFromCenter = Math.max(0, center - centerOffset);
		return maxDistFromCenter > 0 ? 0.2 + 0.8 * (distFromCenter / maxDistFromCenter) : 1;
	}

	/** Same bin index as `computeStatementsViz` / heatmap (`Math.round` then offset from floor(scaleMin)). */
	function binIndexForValue(value, scaleMin, scaleMax) {
		const floorMin = Math.floor(Number(scaleMin));
		const floorMax = Math.floor(Number(scaleMax));
		const binCount = Math.max(1, floorMax - floorMin + 1);
		const rounded = Math.round(value);
		return Math.max(0, Math.min(binCount - 1, rounded - floorMin));
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

	/** @param {object} item */
	/** @param {...unknown} parts */
	function seedFrom(...parts) {
		let h = 0;
		for (const p of parts) {
			const s = String(p);
			for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
		}
		return h;
	}

	/** Deterministic jitter in [-maxMag, maxMag] (stable across renders). */
	function detJitter(seed, maxMag) {
		if (maxMag <= 0) return 0;
		const x = Math.sin(seed * 12.9898) * 43758.5453;
		const u = x - Math.floor(x);
		return (u * 2 - 1) * maxMag;
	}

	/** Daily-response dots on the statement x-scale (All models); null when heatmap mode or no selection. */
	const aggregateDotsLayout = $derived.by(() => {
		if (STATEMENT_DETAIL_AGGREGATE_MODE !== 'dots' || !selectedDetail || !viz || selectedRowIndex < 0)
			return null;
		const item = viz.dim.items[selectedRowIndex];
		const xScale = xScales[selectedRowIndex];
		if (!xScale || !item) return null;

		const { jitterXMaxScaleUnits, radiusPx } = DOT_STRIP_CONFIG;
		const ext = viz.itemExtents[selectedRowIndex] ?? [0, 1];
		const vMin = Math.min(ext[0], ext[1]);
		const vMax = Math.max(ext[0], ext[1]);
		const barH = 30;
		/** @type {{ model: string, color: string, barY: number, barH: number, dots: { cx: number, cy: number, date: string, value: number }[] }[]} */
		const rows = [];
		for (const d of selectedDetail.rows) {
			const series = dailySeriesForStatementModel(
				compiled,
				item.dimensionId,
				item,
				d.model
			);
			const dots = [];
			let i = 0;
			for (const pt of series) {
				const delta = detJitter(seedFrom(d.model, pt.date, i), jitterXMaxScaleUnits);
				const v = Math.min(vMax, Math.max(vMin, pt.value + delta));
				const pxRaw = xScale(v);
				const px = Math.max(radiusPx, Math.min(innerWidth - radiusPx, pxRaw));
				const py = d.y + barH / 2;
				dots.push({ cx: px, cy: py, date: pt.date, value: pt.value });
				i++;
			}
			rows.push({ model: d.model, color: d.color, barY: d.y, barH, dots });
		}
		return {
			centerX: selectedDetail.centerX,
			rows,
			drillItem: item
		};
	});

	/** @param {string | null} [modelOverride] — e.g. row model when `selectedModel` is null (All). */
	function setDrillHover(event, item, date, value, modelOverride = null) {
		const rect = event.currentTarget?.ownerSVGElement?.getBoundingClientRect();
		const localX = rect ? event.clientX - rect.left : 0;
		const localY = rect ? event.clientY - rect.top : 0;
		const pos = clampTooltipPosition(localX + 12, localY - TOOLTIP_HEIGHT - 8);
		const scaleTexts = Array.isArray(item?.statement_scale) ? item.statement_scale : [];
		const responseText =
			scaleTextForValue(
				value,
				scaleTexts,
				Number(item?.scaleMin),
				Number(item?.scaleMax),
				Boolean(item?.reverse)
			) || String(value);
		tooltip = {
			x: pos.x,
			y: pos.y,
			model: modelOverride ?? selectedModel ?? '',
			responseText,
			responseLabel: 'Response',
			metaLine: `Date: ${date}`
		};
	}
</script>

{#if !viz}
	<p class="text-sm text-slate-500">No data.</p>
{:else}
	<div
		class="chart-wrap box-border max-w-full"
		style="width: {width}px; max-width: 100%; height: {height}px;"
	>
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
					{@const axisOpacity = opacityForSubscaleRow(item, isDimmed ? 0.25 : 0.6)}
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
						opacity={axisOpacity}
					/>
					<line
						x1={tickX}
						x2={tickX}
						y1={yi - TICK_HALF_HEIGHT}
						y2={yi + TICK_HALF_HEIGHT}
						stroke={SCALE_TICK_STROKE}
						stroke-width="1.5"
						opacity={axisOpacity}
					/>
					{#if !(isCompactWidth && viz.dim.items.length === 1)}
						<text
							x={-10}
							y={yi}
							fill="#57534e"
							font-size="11"
							font-weight="400"
							text-anchor="end"
							dominant-baseline="middle"
							opacity={axisOpacity}
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
							opacity={axisOpacity}
						>
							{rowRight}
						</text>
					{/if}
				{/each}

				{#each spikeRenderRows as row (`row-${row.rowIndex}`)}
					{@const itemForRow = viz.dim.items[row.rowIndex]}
					{@const isSelectedRow = selectedStatementId
						? itemForRow?.item_id === selectedStatementId
						: false}
					{@const rowOpacity = opacityForSubscaleRow(
						itemForRow ?? {},
						selectedStatementId && !isSelectedRow ? 0.5 : 1
					)}
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

				{#if drillDownLayout}
					{@const dd = drillDownLayout}
					{@const drillItem = viz.dim.items[selectedRowIndex]}
					{@const drillLabelY = (dd.yTop + dd.yBottom) / 2}
					<text
						x={modelLabelX}
						y={drillLabelY}
						fill="#0f172a"
						font-size="12"
						font-weight={detailModelFontWeight}
						text-anchor="end"
						dominant-baseline="middle"
					>
						{selectedModel ?? ''}
					</text>
					<line
						x1={dd.centerX}
						x2={dd.centerX}
						y1={dd.yTop}
						y2={dd.yBottom}
						stroke="#64748b"
						stroke-width="1"
						stroke-opacity="0.6"
					/>
					{#each dd.monthMarkers as m, mi (`${m.label}-${mi}`)}
						<line
							x1={dd.centerX - 5}
							x2={dd.centerX + 5}
							y1={m.y}
							y2={m.y}
							stroke="#64748b"
							stroke-width="1"
							stroke-opacity="0.85"
						/>
						<text
							x={dd.centerX + 8}
							y={m.y}
							fill="#64748b"
							font-size="10"
							font-weight="500"
							text-anchor="start"
							dominant-baseline="middle"
						>
							{m.label}
						</text>
					{/each}
					{#each dd.modelMarkers as mm, mi (`${mm.label}-${mi}`)}
						<text
							x={dd.centerX - 8}
							y={mm.y}
							fill="#0f172a"
							font-size="9"
							font-weight="500"
							text-anchor="end"
							dominant-baseline="middle"
						>
							{mm.label}
						</text>
					{/each}
					{#each dd.points as p (`dot-${p.date}-${p.value}`)}
						<circle
							cx={p.px}
							cy={p.py}
							r={dd.radiusPx}
							fill={dd.lineHue}
							fill-opacity={p.fillOpacity}
							stroke="none"
							role="presentation"
						/>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<circle
							cx={p.px}
							cy={p.py}
							r="8"
							fill="transparent"
							stroke="none"
							role="presentation"
							onmouseenter={(e) => setDrillHover(e, drillItem, p.date, p.value)}
							onmousemove={(e) => setDrillHover(e, drillItem, p.date, p.value)}
							onmouseleave={clearHover}
						/>
					{/each}
				{:else if selectedDetail}
					{#if STATEMENT_DETAIL_AGGREGATE_MODE === 'heatmap'}
						{#each selectedDetail.rows as d (`detail-${d.model}`)}
							{@const selectedItem = viz.dim.items[selectedRowIndex]}
							{@const barY = d.y}
							{@const barH = 30}
							{@const nBins = Math.max(1, d.bins.length)}
							{@const center = (nBins - 1) / 2}
							{@const safeTotal = d.bins.reduce((a, b) => a + Math.max(0, b || 0), 0) || 1}
							{@const binsNorm = d.bins.map((v) => Math.max(0, v || 0) / safeTotal)}
							{@const leftSpan = Math.max(0, selectedDetail.centerX - selectedDetail.chartX0)}
							{@const rightSpan = Math.max(0, selectedDetail.chartX1 - selectedDetail.centerX)}
							<text
								x={modelLabelX}
								y={barY + barH / 2}
								fill="#0f172a"
								font-size="12"
								font-weight={detailModelFontWeight}
								text-anchor="end"
								dominant-baseline="middle"
							>
								{d.model}
							</text>
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
					{:else if aggregateDotsLayout}
						{@const adl = aggregateDotsLayout}
						{#each adl.rows as row (`dots-row-${row.model}`)}
							<text
								x={modelLabelX}
								y={row.barY + row.barH / 2}
								fill="#0f172a"
								font-size="12"
								font-weight={detailModelFontWeight}
								text-anchor="end"
								dominant-baseline="middle"
							>
								{row.model}
							</text>
							<line
								x1={adl.centerX}
								x2={adl.centerX}
								y1={row.barY - 2}
								y2={row.barY + row.barH + 2}
								stroke="#64748b"
								stroke-width="1"
								stroke-opacity="0.6"
							/>
							{#each row.dots as dot, di (`${row.model}-${dot.date}-${di}`)}
								<circle
									cx={dot.cx}
									cy={dot.cy}
									r={DOT_STRIP_CONFIG.radiusPx}
									fill={row.color}
									fill-opacity={DOT_STRIP_CONFIG.fillOpacity}
									stroke="none"
									role="presentation"
								/>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<circle
									cx={dot.cx}
									cy={dot.cy}
									r="8"
									fill="transparent"
									stroke="none"
									role="presentation"
									onmouseenter={(e) =>
										setDrillHover(e, adl.drillItem, dot.date, dot.value, row.model)}
									onmousemove={(e) =>
										setDrillHover(e, adl.drillItem, dot.date, dot.value, row.model)}
									onmouseleave={clearHover}
								/>
							{/each}
						{/each}
					{/if}
				{/if}

				{#if isCompactWidth && viz.dim.items.length === 1}
					{@const axisItem0 = viz.dim.items[0]}
					{@const epMin = endpointTextForSide(axisItem0, 'min')}
					{@const epMax = endpointTextForSide(axisItem0, 'max')}
					{@const capLeft = axisItem0?.reverse ? epMax : epMin}
					{@const capRight = axisItem0?.reverse ? epMin : epMax}
					{@const yi0 = rowCentersY[0]}
					<!-- Tight under bump midline tick; x inset pulls captions toward the vertical center line. -->
					{@const epY = yi0 + TICK_HALF_HEIGHT + 3}
					{@const capXInset = Math.max(6, Math.min(56, Math.round(innerWidth * 0.14)))}
					<text
						x={-20}
						y={epY - 10}
						fill="#57534e"
						font-size="10"
						font-weight="400"
						text-anchor="start"
						dominant-baseline="hanging"
					>
						← {capLeft}
					</text>
					<text
						x={innerWidth + 20 }
						y={epY - 10}
						fill="#57534e"
						font-size="10"
						font-weight="400"
						text-anchor="end"
						dominant-baseline="hanging"
					>
						{capRight} →
					</text>
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
				metaLine={tooltip.metaLine ?? ''}
			/>
		{/if}
	</div>
{/if}

<style>
	.chart-wrap {
		position: relative;
	}
</style>
