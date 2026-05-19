<script>
	import * as d3 from 'd3';
	import { modelColor } from '$lib/viz/modelColors.js';
	import { statementLabel } from '$lib/ui/statementLabel.js';
	import VizTooltip from '$lib/ui/VizTooltip.svelte';
	import { scaleTextForValue } from '$lib/viz/valuePalette.js';
	import {
		STATEMENT_ORDER_DIVERGENCE,
		STATEMENT_ORDER_SUBSCALE
	} from '$lib/data/computeStatementsViz.js';
	import { subscaleInterpretation } from '$lib/data/dataset.js';

	/** Pixels beyond outer label ring; keeps curved labels inside the clip. */
	const DISC_CLIP_OUTSET = 0;
	/** White ring between grey hub and inner end of value scale (spike bases). */
	const INNER_SCALE_WHITE_PAD = 14;
	/** Inner hub disc fill. */
	const HUB_FILL = '#ffffff';
	/** Radial spokes from hub toward plot (white on dark subscale ring). */
	const RADIAL_SPOKE_STROKE = '#ffffff';
	const SUBSCALE_SPOKE_WIDTH = 1;
	const SUBSCALE_RIM_WIDTH = 1;
	const DIMENSION_SPOKE_WIDTH = 1;
	/** Outer subscale annulus fill + midpoint reference ring stroke. */
	const DIMENSION_RING_FILL = '#3B3A3A';
	const DIMENSION_RING_OPACITY = 0.9;
	/** Arc and radial separators on the outer subscale annulus. */
	const DIMENSION_RING_SEPARATOR = '#ffffff';
	const SELECTED_PATH_STROKE = '#0a0a0a';
	const INACTIVE_MODEL_PATH_STROKE = '#a8a29e';
	/**
	 * Wedge “fits” check: keep lenient so long names (e.g. Redistribution, Restricted Democracy) still show.
	 * (Previously raising a single constant broke `labelFits` for many subscales.)
	 */
	const SUBSCALE_LABEL_CHAR_PX_FIT = 3.5;
	/** Conservative px/char when computing expanded arcs for Immigration / Environment (avoid clipping). */
	const SUBSCALE_LABEL_CHAR_PX_EXPAND = 6.5;
	const SUBSCALE_LABEL_ARC_PAD_PX = 1;
	/** Inset pole label arcs slightly from hub / outer clip so glyphs stay inside the value band. */
	const POLE_LABEL_OUTER_INSET = 2;
	const POLE_LABEL_INNER_INSET = 2;
	/** Est. px per character along arc for pole label span (inner ring is shortest arc). */
	const POLE_LABEL_CHAR_PX = 5.5;
	/** Max angular span for a pole arc (~200°) so paths stay well-defined. */
	const POLE_LABEL_MAX_SPAN_RAD = Math.PI * 1.15;
	/** Served from `static/Group 77.png` (SvelteKit root). */
	const RADIAL_LEGEND_SRC = '/Group%2077.png';

	/** Extra radial reach for spike tips vs the nominal value band (± px from `scaleInnerR` / `plotOuterR`). */
	const SPIKE_RADIUS_EXTENSION_PX = 20;
	const DEBATE_SPIKE_INNER_EXTEND_PX = 10;
	const DEBATE_SPIKE_OUTER_EXTEND_PX = 14;

	/** Gap between spike outer limit and inner edge of the grey subscale ring (px). */
	const LABEL_BAND = 30;
	/** Radial thickness of the grey subscale ring (`fullOuterR − dimensionInnerR`). */
	const SUBSCALE_RING_WIDTH = 22;

	/**
	 * @typedef {object} Viz
	 * @property {{ items: object[] }} dim
	 * @property {{ fundModel: string, itemMeans: (number|null)[] }[]} modelSeries
	 * @property {[number, number][]} itemExtents
	 * @property {{ aggregate: object, item: object }} labels
	 */

	/** @type {{ width: number, height: number, viz: Viz, selectedModel: (string|null), selectedModels?: string[], debatePrimaryTensions?: string[], radialSortMode?: ('subscale'|'divergence'), onRadialSortModeChange?: ((mode: 'subscale'|'divergence') => void), highlightSubscaleKey?: (string|null), onSubscaleWedgeClick?: ((subscaleKey: string) => void), statementSelectEnabled?: boolean, onStatementSelect?: ((itemId: string) => void) }} */
	let {
		width,
		height,
		viz,
		selectedModel,
		selectedModels = [],
		debatePrimaryTensions = [],
		radialSortMode = STATEMENT_ORDER_SUBSCALE,
		onRadialSortModeChange = () => {},
		highlightSubscaleKey = null,
		onSubscaleWedgeClick = () => {},
		statementSelectEnabled = true,
		onStatementSelect = () => {}
	} = $props();
	let legendOpen = $state(false);
	const isDebateMode = $derived(Array.isArray(debatePrimaryTensions) && debatePrimaryTensions.length > 0);
	const showGroupingMarkers = $derived(!isDebateMode && radialSortMode !== STATEMENT_ORDER_DIVERGENCE);
	const visibleModelSeries = $derived.by(() => {
		if (!viz?.modelSeries?.length) return [];
		const filter = Array.isArray(selectedModels)
			? Array.from(new Set(selectedModels.map((m) => String(m ?? '').trim()).filter(Boolean)))
			: [];
		if (!filter.length) return viz.modelSeries;
		return viz.modelSeries.filter((s) => filter.includes(s.fundModel));
	});
	const isSingleVisibleModel = $derived(visibleModelSeries.length === 1);
	const singleVisibleModel = $derived(isSingleVisibleModel ? visibleModelSeries[0] : null);
	/** Mobile breakpoint heuristic: hide dense outer labels on smaller charts. */
	const hideSubscaleLabels = $derived(Math.min(width, height) < 520);

	/** Preview the same highlight/card as a wedge click while pointer is over the ring or its label. */
	let hoverSubscaleKey = $state(/** @type {string | null} */ (null));
	let hoverClearTimeoutId = 0;
	function armClearSubscaleHover() {
		if (hoverClearTimeoutId) clearTimeout(hoverClearTimeoutId);
		hoverClearTimeoutId = setTimeout(() => {
			hoverClearTimeoutId = 0;
			hoverSubscaleKey = null;
		}, 50);
	}
	/** @param {unknown} key */
	function setSubscaleHoverKey(key) {
		if (hoverClearTimeoutId) {
			clearTimeout(hoverClearTimeoutId);
			hoverClearTimeoutId = 0;
		}
		hoverSubscaleKey = key == null ? null : String(key);
	}
	function clearSubscaleHoverKey() {
		armClearSubscaleHover();
	}

	const effectiveHighlightSubscaleKey = $derived.by(() => {
		const h = hoverSubscaleKey;
		if (h != null && String(h).trim() !== '') return h;
		return highlightSubscaleKey;
	});

	/** Subscales whose center card sits over dense spikes; nudge up in SVG coords. */
	const CENTER_CARD_Y_OFFSET_UP = 30;
	const centerCardExtraYOffset = (normalizedLabel) => {
		const k = normalizedLabel.toLowerCase();
		if (k === 'civic violation tolerance' || k === 'authoritarianism') return CENTER_CARD_Y_OFFSET_UP;
		return 0;
	};

	const HIGHLIGHT_DIM_OPACITY = 0.0;

	/** When a subscale is highlighted from the context rail, dim other statements (all stay visible). */
	function opacityForStatementIndex(i) {
		const eff = effectiveHighlightSubscaleKey;
		if (eff == null || String(eff).trim() === '') {
			return 1;
		}
		const item = viz?.dim?.items?.[i];
		const k = String(item?.subscaleKey ?? '').trim() || '__none__';
		return normSubscaleKey(k) === normSubscaleKey(eff) ? 1 : HIGHLIGHT_DIM_OPACITY;
	}
	/** In divergence mode, spikes extend much farther — space that was label + dimension rings in dimension mode. */
	const DIVERGENCE_OUTER_R_PAD = 6;

	/**
	 * @type { { kind: 'dot', x: number, y: number, placeLeft: boolean, allModelsMode: boolean, model: string, statementText: string, responseText: string }
	 *   | null }
	 */
	let tooltip = $state(null);

	/** Inset from SVG edge to plot (spokes use full usable side = min(w,h) − 2×PAD). */
	const PAD = 8;
	const TOOLTIP_PAD = 8;
	/** Fixed width for radial hover tooltip (shell-relative positioning). */
	const RADIAL_TOOLTIP_W = 280;
	const RADIAL_TOOLTIP_EST_H = 148;

	/** Positive minor angular span from boundary t0 to t1 (radians, ≤ 2π). */
	function sectorSpan(t0, t1) {
		let da = t1 - t0;
		while (da < 0) da += 2 * Math.PI;
		while (da > 2 * Math.PI) da -= 2 * Math.PI;
		return da;
	}

	/** Sector arc for strokes (t0 → t1, minor arc, clockwise). */
	function geometricSectorArcD(cx, cy, r, t0, t1) {
		const x0 = cx + r * Math.cos(t0);
		const y0 = cy + r * Math.sin(t0);
		const x1 = cx + r * Math.cos(t1);
		const y1 = cy + r * Math.sin(t1);
		const da = sectorSpan(t0, t1);
		const largeArc = da > Math.PI ? 1 : 0;
		return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
	}

	/** Closed annular sector path (outer arc t0→t1, inner arc t1→t0). */
	function annularSectorPathD(cx, cy, rInner, rOuter, t0, t1) {
		const ox0 = cx + rOuter * Math.cos(t0);
		const oy0 = cy + rOuter * Math.sin(t0);
		const ox1 = cx + rOuter * Math.cos(t1);
		const oy1 = cy + rOuter * Math.sin(t1);
		const ix1 = cx + rInner * Math.cos(t1);
		const iy1 = cy + rInner * Math.sin(t1);
		const ix0 = cx + rInner * Math.cos(t0);
		const iy0 = cy + rInner * Math.sin(t0);
		const da = sectorSpan(t0, t1);
		const largeArc = da > Math.PI ? 1 : 0;
		return `M ${ox0} ${oy0} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${rInner} ${rInner} 0 ${largeArc} 0 ${ix0} ${iy0} Z`;
	}

	/**
	 * Minor arc on the label circle (same center + radius as the ring midline).
	 * When reverse, traverse t1 → t0 with sweep 0 so glyphs read upright without using a different radius or wrong large-arc.
	 * @param {boolean} reverse — flip text direction along the same geometric arc
	 */
	function labelCircleArcD(cx, cy, r, t0, t1, reverse) {
		const da = sectorSpan(t0, t1);
		const largeArc = da > Math.PI ? 1 : 0;
		if (!reverse) {
			return geometricSectorArcD(cx, cy, r, t0, t1);
		}
		const xs = cx + r * Math.cos(t1);
		const ys = cy + r * Math.sin(t1);
		const xe = cx + r * Math.cos(t0);
		const ye = cy + r * Math.sin(t0);
		return `M ${xs} ${ys} A ${r} ${r} 0 ${largeArc} 0 ${xe} ${ye}`;
	}

	/**
	 * Reverse path direction along the same minor arc so glyphs read upright from outside the ring.
	 * Any sector whose midpoint is in the lower half (sin > 0) needs reversal; forward sweep there reads
	 * upside-down. Upper-left stays forward (sin < 0). Pure left (9 o’clock, |sin| ≈ 0) also reverses.
	 */
	function labelPathReverse(mid) {
		if (Math.sin(mid) > 1e-10) return true;
		return Math.cos(mid) < -1e-9 && Math.abs(Math.sin(mid)) < 0.22;
	}

	/** @param {number} mid @param {unknown} subscaleKey */
	function labelPathReverseForArc(mid, subscaleKey) {
		let rev = labelPathReverse(mid);
		const k = String(subscaleKey ?? '').trim().toLowerCase();
		if (k === 'technocracy' || k === 'environment') rev = !rev;
		return rev;
	}

	/**
	 * Widen angular span so long subscale names fit on the label radius (used when Immigration/Environment is selected).
	 * @param {number} t0
	 * @param {number} t1
	 * @param {number} labelR
	 * @param {string} label
	 */
	function expandedSubscaleLabelArc(t0, t1, labelR, label) {
		const mid = (t0 + t1) / 2;
		const wedgeSpan = sectorSpan(t0, t1);
		const estTextPx = String(label).trim().length * SUBSCALE_LABEL_CHAR_PX_EXPAND;
		const needSpanRad = Math.min(
			Math.PI * 1.55,
			(estTextPx * 1.5 + SUBSCALE_LABEL_ARC_PAD_PX * 4) / Math.max(labelR, 1e-6)
		);
		const span = Math.max(wedgeSpan, needSpanRad);
		return { t0: mid - span / 2, t1: mid + span / 2 };
	}

	/**
	 * Widen pole text paths past the subscale wedge when needed so long strings fit on the inner ring.
	 * When a subscale is highlighted, overlapping adjacent sectors is acceptable (their labels are off).
	 *
	 * @param {number} t0
	 * @param {number} t1
	 * @param {number} innerR — inner pole arc radius (bottleneck for arc length)
	 * @param {string[]} texts
	 */
	/* Selected-subscale high/low pole labels — restore with `focusedSubscalePoleLabels` markup below
	function poleLabelSpanAngles(t0, t1, innerR, texts) {
		const mid = (t0 + t1) / 2;
		const wedgeSpan = sectorSpan(t0, t1);
		let maxLen = 0;
		for (const s of texts) {
			const n = String(s ?? '').length;
			if (n > maxLen) maxLen = n;
		}
		if (maxLen === 0 || innerR < 1e-6) return { t0p: t0, t1p: t1 };
		const estPx = maxLen * POLE_LABEL_CHAR_PX;
		const needSpan = Math.min(POLE_LABEL_MAX_SPAN_RAD, (estPx * 1.4) / innerR);
		const span = Math.max(wedgeSpan, needSpan);
		return {
			t0p: mid - span / 2,
			t1p: mid + span / 2
		};
	}
	*/

	/**
	 * @param {object[]} items
	 * @param {number} n
	 */
	function subscaleRuns(items, n) {
		if (!n) return [];
		const keyOf = (it) => `${it.dimensionId}::${it.subscaleKey ?? ''}`;
		/** @type {{ i0: number, i1: number, label: string }[]} */
		const runs = [];
		let start = 0;
		for (let i = 1; i <= n; i++) {
			if (i === n || keyOf(items[i]) !== keyOf(items[start])) {
				runs.push({
					i0: start,
					i1: i - 1,
					label: String(items[start].subscaleLabel ?? '')
				});
				start = i;
			}
		}
		return runs;
	}

	const layout = $derived.by(() => {
		if (!viz?.dim?.items?.length) {
			return {
				cx: width / 2,
				cy: height / 2,
				fullOuterR: 40,
				dimensionInnerR: 30,
				plotOuterR: 32,
				dimensionLabelR: 38,
				hubR: 14,
				scaleInnerR: 28,
				spikeRangeInner: 28,
				spikeRangeOuter: 32,
				clipEdgeR: 30,
				angles: /** @type {number[]} */ ([]),
				rScales: /** @type {import('d3').ScaleLinear<number, number>[]} */ ([]),
				n: 0,
				subscaleArcs: /** @type {{ id: string, label: string, i0: number, i1: number, t0: number, t1: number, textPathD: string }[]} */ (
					[]
				),
			};
		}
		const n = viz.dim.items.length;
		const cx = width / 2;
		const chartMin = Math.min(width, height);
		const debateCompact = isDebateMode && chartMin < 520;
		/* Nudge debate plot upward — extra space below from header / feed on mobile. */
		const cy =
			height / 2 - (isDebateMode ? chartMin * (debateCompact ? 0.2 : 0.14) : 0);
		const side = Math.max(
			120,
			chartMin - 2 * PAD + (debateCompact ? 24 : 40)
		);
		const fullOuterR = side / 2;
		const divergenceMode = radialSortMode === STATEMENT_ORDER_DIVERGENCE;
		/** Subscale label ring is hidden: reclaim that band so the value plot uses the full disc. */
		const expandPlotToFullDisc = divergenceMode || hideSubscaleLabels;

		let dimensionInnerR;
		let plotOuterR;
		let hubR;
		let scaleInnerR;
		let dimensionLabelR;

		if (expandPlotToFullDisc) {
			/**
			 * Outer plot limit: nearly to clip circle (was label + dimension annuli in dimension mode).
			 * Push 20px farther out to reclaim even more of the freed subscale-label band on mobile.
			 */
			plotOuterR = Math.max(28, fullOuterR - DIVERGENCE_OUTER_R_PAD + 20);
			hubR = Math.max(14, plotOuterR * 0.17);
			scaleInnerR = Math.max(
				hubR + 2,
				Math.min(hubR + INNER_SCALE_WHITE_PAD, plotOuterR - 6)
			);
			dimensionInnerR = Math.max(plotOuterR + 2, fullOuterR - 2);
			dimensionLabelR = (dimensionInnerR + fullOuterR) / 2;
		} else {
			dimensionInnerR = Math.max(24, fullOuterR - SUBSCALE_RING_WIDTH);
			plotOuterR = Math.min(Math.max(20, dimensionInnerR - LABEL_BAND), dimensionInnerR - 4);
			/** Grey hub; value scale and spikes start at scaleInnerR (white pad between). */
			hubR = Math.max(14, plotOuterR * 0.17);
			scaleInnerR = Math.max(
				hubR + 2,
				Math.min(hubR + INNER_SCALE_WHITE_PAD, plotOuterR - 6)
			);
			dimensionLabelR = (dimensionInnerR + fullOuterR) / 2;
		}

		let spikeRangeInner = Math.max(hubR + 2, scaleInnerR - SPIKE_RADIUS_EXTENSION_PX);
		let spikeRangeOuter = plotOuterR + SPIKE_RADIUS_EXTENSION_PX + (expandPlotToFullDisc ? 20 : 0);
		if (expandPlotToFullDisc) {
			spikeRangeOuter = Math.min(fullOuterR - 2, spikeRangeOuter);
		} else {
			spikeRangeOuter = Math.min(dimensionInnerR - 2, spikeRangeOuter);
		}
		if (isDebateMode) {
			spikeRangeInner = Math.max(hubR + 2, spikeRangeInner - DEBATE_SPIKE_INNER_EXTEND_PX);
			const debateOuterCap = expandPlotToFullDisc ? fullOuterR - 2 : dimensionInnerR - 2;
			spikeRangeOuter = Math.min(debateOuterCap, spikeRangeOuter + DEBATE_SPIKE_OUTER_EXTEND_PX);
		}
		if (spikeRangeInner >= spikeRangeOuter - 1e-6) {
			spikeRangeOuter = spikeRangeInner + Math.max(4, SPIKE_RADIUS_EXTENSION_PX);
		}

		/** Debate: rotate so the first spoke is down (π/2); non-debate: first spoke up (−π/2). Two upper spokes for n=3. */
		const angleBase = isDebateMode ? Math.PI / 2 : -Math.PI / 2;

		const angles = [];
		const rScales = [];
		for (let i = 0; i < n; i++) {
			angles.push(angleBase + (i / n) * 2 * Math.PI);
			const ext = viz.itemExtents[i] ?? [0, 1];
			rScales.push(d3.scaleLinear().domain(ext).range([spikeRangeInner, spikeRangeOuter]));
		}

		const items = viz.dim.items;
		const runs = subscaleRuns(items, n);
		const tau = 2 * Math.PI;
		const hlNorm = normSubscaleKey(effectiveHighlightSubscaleKey);
		const hlActive = hlNorm !== '__none__';

		const subscaleArcs = runs.map((run, idx) => {
			const t0 = angleBase + ((run.i0 - 0.5) / n) * tau;
			const t1 = angleBase + ((run.i1 + 0.5) / n) * tau;
			const label = run.label;
			const itemSk = items[run.i0]?.subscaleKey;
			const skLower = String(itemSk ?? '').trim().toLowerCase();
			const arcLenPx = sectorSpan(t0, t1) * dimensionLabelR;
			const estTextPxFit = String(label).trim().length * SUBSCALE_LABEL_CHAR_PX_FIT;
			const labelFits = estTextPxFit + SUBSCALE_LABEL_ARC_PAD_PX <= arcLenPx;

			const mustExpand =
				hlActive &&
				(skLower === 'immigration' || skLower === 'environment') &&
				normSubscaleKey(itemSk) === hlNorm;

			let pathT0 = t0;
			let pathT1 = t1;
			if (mustExpand) {
				const ex = expandedSubscaleLabelArc(t0, t1, dimensionLabelR, label);
				pathT0 = ex.t0;
				pathT1 = ex.t1;
			}
			const pathMid = (pathT0 + pathT1) / 2;

			return {
				id: `subscale-tp-${idx}`,
				label,
				labelFits,
				subscaleKey: itemSk,
				i0: run.i0,
				i1: run.i1,
				t0,
				t1,
				textPathD: labelCircleArcD(
					cx,
					cy,
					dimensionLabelR,
					pathT0,
					pathT1,
					labelPathReverseForArc(pathMid, itemSk)
				)
			};
		});

		return {
			cx,
			cy,
			fullOuterR,
			dimensionInnerR,
			plotOuterR,
			dimensionLabelR,
			hubR,
			scaleInnerR,
			spikeRangeInner,
			spikeRangeOuter,
			clipEdgeR: dimensionInnerR,
			angles,
			rScales,
			n,
			subscaleArcs
		};
	});

	function normSubscaleKey(k) {
		const s = String(k ?? '').trim();
		return s || '__none__';
	}

	/**
	 * @param {Viz | null | undefined} vizIn
	 * @param {unknown} key
	 */
	function centerCardForSubscaleKey(vizIn, key) {
		const kn = normSubscaleKey(key);
		if (kn === '__none__') return null;
		const items = vizIn?.dim?.items;
		if (!items?.length) return null;
		const item = items.find((it) => normSubscaleKey(it.subscaleKey) === kn);
		if (!item) return null;
		const dimId = item.dimensionId;
		const sk = String(item.subscaleKey ?? '').trim();
		const byDim = /** @type {Record<string, Record<string, { label?: string, description?: string }>>} */ (
			subscaleInterpretation
		);
		const interp = byDim[String(dimId)]?.[sk];
		const label = String(interp?.label ?? item.subscaleLabel ?? '').trim();
		const description = String(interp?.description ?? '').trim();
		if (!label) return null;
		return { label, description };
	}

	const centerCardLayout = $derived.by(() => {
		const card = centerCardForSubscaleKey(viz, effectiveHighlightSubscaleKey);
		if (!card?.label) return null;
		const label = String(card.label ?? '').trim();
		const description = String(card.description ?? '').trim();
		const cardW = hideSubscaleLabels
			? Math.max(150, Math.min(240, width * 0.58))
			: Math.max(170, Math.min(260, width * 0.45));
		const cardH = description ? 96 : 62;
		const yUp = centerCardExtraYOffset(label);
		return {
			label,
			description,
			cardW,
			cardH,
			x: layout.cx - cardW / 2,
			y: layout.cy - cardH / 2 - yUp
		};
	});

	/** Context rail highlights one subscale: hide other subscale wedge labels (option B). */
	const subscaleHighlightLocked = $derived(
		effectiveHighlightSubscaleKey != null && String(effectiveHighlightSubscaleKey).trim() !== ''
	);

	/**
	 * Immigration / Environment: only when that subscale is selected (path uses expanded arc then).
	 * Other subscales: show when they fit unless rail highlight hides them.
	 * @param {{ labelFits: boolean, i0: number }} arc
	 */
	function shouldShowSubscaleOuterLabel(arc) {
		if (!viz?.dim?.items?.[arc.i0]) return false;
		const itemSk = viz.dim.items[arc.i0]?.subscaleKey;
		const skLower = String(itemSk ?? '').trim().toLowerCase();

		if (skLower === 'immigration' || skLower === 'environment') {
			if (!subscaleHighlightLocked) return false;
			return normSubscaleKey(effectiveHighlightSubscaleKey) === normSubscaleKey(itemSk);
		}

		if (!arc.labelFits) return false;
		if (!subscaleHighlightLocked) return true;
		return normSubscaleKey(effectiveHighlightSubscaleKey) === normSubscaleKey(itemSk);
	}

	/**
	 * Pole copy from `statement_encoding.json` (`statement_values`), on arcs at the spike axis
	 * endpoints: `plotOuterR` (domain max) and `scaleInnerR` (domain min). Arc span widens as needed
	 * so long strings are not truncated on the inner ring (may extend past the wedge angle).
	 */
	/* Restore with pole paths in <defs> and `.subscale-pole-label` group below
	const focusedSubscalePoleLabels = $derived.by(() => {
		if (!subscaleHighlightLocked || !viz?.dim?.items?.length || !layout?.n) return null;
		const want = normSubscaleKey(highlightSubscaleKey);
		const arc = layout.subscaleArcs.find(
			(a) => normSubscaleKey(viz.dim.items[a.i0]?.subscaleKey) === want
		);
		if (!arc) return null;
		const item = viz.dim.items[arc.i0];
		const sv = item?.statement_values;
		let low = String(sv?.min ?? '').trim();
		let high = String(sv?.max ?? '').trim();
		if ((!low || !high) && Array.isArray(item.statement_scale) && item.statement_scale.length >= 2) {
			if (!low) low = String(item.statement_scale[0] ?? '').trim();
			if (!high) high = String(item.statement_scale[item.statement_scale.length - 1] ?? '').trim();
		}
		if (!low && !high) return null;
		const rev = Boolean(item?.reverse);
		let outerText = '';
		let innerText = '';
		if (low && high) {
			outerText = rev ? low : high;
			innerText = rev ? high : low;
		} else {
			const only = low || high;
			outerText = only;
			innerText = '';
		}
		const refR = (layout.scaleInnerR + layout.plotOuterR) / 2;
		let outerR = layout.plotOuterR - POLE_LABEL_OUTER_INSET;
		let innerR = layout.scaleInnerR + POLE_LABEL_INNER_INSET;
		if (outerR <= innerR) {
			outerR = layout.plotOuterR;
			innerR = layout.scaleInnerR;
		}
		const { cx, cy } = layout;
		const t0 = arc.t0;
		const t1 = arc.t1;
		const mid = (t0 + t1) / 2;
		const pathReverse = labelPathReverse(mid);
		const textsForSpan = innerText ? [outerText, innerText] : [outerText];
		const { t0p, t1p } = poleLabelSpanAngles(t0, t1, innerR, textsForSpan);
		const outerPathD = labelCircleArcD(cx, cy, outerR, t0p, t1p, pathReverse);
		const innerPathD = labelCircleArcD(cx, cy, innerR, t0p, t1p, pathReverse);
		const { t0p: ts0, t1p: ts1 } = poleLabelSpanAngles(t0, t1, refR, [outerText]);
		const singlePathD = labelCircleArcD(cx, cy, refR, ts0, ts1, pathReverse);
		return {
			outerText,
			innerText,
			outerPathD,
			innerPathD,
			singlePathD,
			twoPoles: Boolean(low && high)
		};
	});
	*/

	/** Local (0,0-centered) arc path for statement bump caps. */
	function arcPathLocalD(r, t0, t1) {
		const x0 = r * Math.cos(t0);
		const y0 = r * Math.sin(t0);
		const x1 = r * Math.cos(t1);
		const y1 = r * Math.sin(t1);
		const da = sectorSpan(t0, t1);
		const largeArc = da > Math.PI ? 1 : 0;
		return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
	}

	/** Scale midpoint radius on spoke i (same ref as areaRadial bands). */
	function refRadiusAtIndex(i) {
		const item = viz.dim.items[i];
		const min = Number(item?.scaleMin);
		const max = Number(item?.scaleMax);
		const ext = viz.itemExtents[i] ?? [0, 1];
		const refV =
			Number.isFinite(min) && Number.isFinite(max)
				? (min + max) / 2
				: (Number(ext[0]) + Number(ext[1])) / 2;
		return layout.rScales[i](refV);
	}

	/**
	 * Data radius on spoke i (missing mean → ref), matching area inner/outer split inputs.
	 * @param {{ fundModel: string, itemMeans: (number|null)[] }} m
	 */
	function effectiveRForModelAt(m, i) {
		const rRef = refRadiusAtIndex(i);
		const v = m.itemMeans[i];
		if (v !== null && v !== undefined && Number.isFinite(v)) return layout.rScales[i](v);
		return rRef;
	}

	const meanPathRefRadii = $derived.by(() => {
		const n = layout.n;
		if (!n) return /** @type {number[]} */ ([]);
		const out = [];
		for (let i = 0; i < n; i++) out.push(refRadiusAtIndex(i));
		return out;
	});

	/** Sample budget scale for deviation fills (cardinal path resampled to polar quads vs ref). */
	function denseSegCount(n) {
		return Math.max(96, n * 16);
	}

	const TAU = 2 * Math.PI;

	/** Shared with stroke: bands sample this exact cardinal spline in local (x,y). */
	const MEAN_CARDINAL_TENSION = 0.5;
	const meanLineCurve = d3.curveCardinal.tension(MEAN_CARDINAL_TENSION);
	const subscaleMeanLineOpen = d3.line().curve(meanLineCurve);

	/**
	 * @param {[number, number][]} pts
	 * @param {(context: import('d3').Path) => import('d3').Curve} curveFactory — same as line().curve(...)
	 */
	function recordLineSegmentsWithCurve(pts, curveFactory) {
		/** @type {{ kind: 'M'|'L'|'C', x: number, y: number, x1?: number, y1?: number, x2?: number, y2?: number }[]} */
		const segs = [];
		const ctx = {
			moveTo(x, y) {
				segs.push({ kind: 'M', x, y });
			},
			lineTo(x, y) {
				segs.push({ kind: 'L', x, y });
			},
			bezierCurveTo(x1, y1, x2, y2, x, y) {
				segs.push({ kind: 'C', x, y, x1, y1, x2, y2 });
			},
			closePath() {}
		};
		const curve = curveFactory(ctx);
		curve.lineStart();
		for (const p of pts) curve.point(p[0], p[1]);
		curve.lineEnd();
		return segs;
	}

	function polarFromLocalXY(x, y) {
		const rr = Math.hypot(x, y);
		if (rr < 1e-9) return { theta: 0, r: 0 };
		return { theta: Math.atan2(y, x), r: rr };
	}

	/**
	 * Walk recorded SVG-style segments; sample cubics/lines so band quads follow the same path as the stroke.
	 * @param {{ kind: 'M'|'L'|'C', x: number, y: number, x1?: number, y1?: number, x2?: number, y2?: number }[]} segs
	 */
	function samplePathSegmentsToPolar(segs, budget) {
		let px = 0;
		let py = 0;
		let started = false;
		let nC = 0;
		let nL = 0;
		for (const s of segs) {
			if (s.kind === 'C') nC++;
			else if (s.kind === 'L') nL++;
		}
		const parts = Math.max(1, nC + nL);
		const stepsCurve = Math.max(6, Math.ceil(budget / parts));

		/** @type {{ theta: number, r: number }[]} */
		const out = [];

		for (const s of segs) {
			if (s.kind === 'M') {
				px = s.x;
				py = s.y;
				started = true;
				out.push(polarFromLocalXY(px, py));
			} else if (s.kind === 'L' && started) {
				const x1 = s.x;
				const y1 = s.y;
				for (let i = 1; i <= stepsCurve; i++) {
					const t = i / stepsCurve;
					out.push(polarFromLocalXY(px + t * (x1 - px), py + t * (y1 - py)));
				}
				px = x1;
				py = y1;
			} else if (s.kind === 'C' && started) {
				const x0 = px;
				const y0 = py;
				const cp1x = s.x1 ?? 0;
				const cp1y = s.y1 ?? 0;
				const cp2x = s.x2 ?? 0;
				const cp2y = s.y2 ?? 0;
				const x3 = s.x;
				const y3 = s.y;
				for (let i = 1; i <= stepsCurve; i++) {
					const t = i / stepsCurve;
					const omt = 1 - t;
					const x =
						omt * omt * omt * x0 +
						3 * omt * omt * t * cp1x +
						3 * omt * t * t * cp2x +
						t * t * t * x3;
					const y =
						omt * omt * omt * y0 +
						3 * omt * omt * t * cp1y +
						3 * omt * t * t * cp2y +
						t * t * t * y3;
					out.push(polarFromLocalXY(x, y));
				}
				px = x3;
				py = y3;
			}
		}
		return out;
	}

	function wedgeMeanPointsLocalXY(arc, n, rRef, rData) {
		/** @type {[number, number][]} */
		const pts = [];
		pts.push(ptLocalPolar(sampleRCyclic(arc.t0, n, rRef), arc.t0));
		for (let i = arc.i0; i <= arc.i1; i++) {
			pts.push(ptLocalPolar(rData[i], layout.angles[i]));
		}
		pts.push(ptLocalPolar(sampleRCyclic(arc.t1, n, rRef), arc.t1));
		return pts;
	}

	/** Piecewise-linear r(θ) between spokes (same indexing as layout.angles). */
	function sampleRCyclic(theta, n, rArr) {
		let u = ((theta + Math.PI / 2) / TAU) * n;
		u = ((u % n) + n) % n;
		const i = Math.min(n - 1, Math.max(0, Math.floor(u)));
		const i1 = (i + 1) % n;
		const t = u - Math.floor(u);
		return rArr[i] * (1 - t) + rArr[i1] * t;
	}

	function ptLocalPolar(r, theta) {
		return [r * Math.cos(theta), r * Math.sin(theta)];
	}

	/**
	 * Dense (θ, r) samples for deviation math along the same cardinal spline as `subscaleMeanPolylinePathLocalD`
	 * (shared control points + `meanLineCurve`).
	 */
	function wedgeMeanSamplesAlongPolyline(arc, n, rRef, rData, baseSeg) {
		const pts = wedgeMeanPointsLocalXY(arc, n, rRef, rData);
		if (pts.length < 2) return [];
		const segs = recordLineSegmentsWithCurve(pts, meanLineCurve);
		const wedgeSpan = sectorSpan(arc.t0, arc.t1);
		const budget = Math.max(96, Math.ceil(baseSeg * (wedgeSpan / TAU)));
		return samplePathSegmentsToPolar(segs, budget);
	}

	/**
	 * Deviation clips per subscale wedge: trapezoids follow the same cardinal mean as the black stroke.
	 */
	function deviationBandPathsPerSubscaleD(
		n,
		rRef,
		rData,
		/** @type {{ t0: number, t1: number, i0: number, i1: number }[]} */ arcs
	) {
		/** @type {string[]} */
		const belowParts = [];
		/** @type {string[]} */
		const aboveParts = [];

		/** @param {boolean} isBelow */
		function pushTrap(isBelow, t0, t1, rd0, rd1, rr0, rr1) {
			const [iax, iay] = ptLocalPolar(isBelow ? rd0 : rr0, t0);
			const [ibx, iby] = ptLocalPolar(isBelow ? rd1 : rr1, t1);
			const [obx, oby] = ptLocalPolar(isBelow ? rr1 : rd1, t1);
			const [oax, oay] = ptLocalPolar(isBelow ? rr0 : rd0, t0);
			const part = `M ${iax} ${iay} L ${ibx} ${iby} L ${obx} ${oby} L ${oax} ${oay} Z`;
			(isBelow ? belowParts : aboveParts).push(part);
		}

		function addBelowSegment(ta, tb, rDa, rDb, rRa, rRb) {
			const fa = rDa - rRa;
			const fb = rDb - rRb;
			if (fa < 0 && fb < 0) {
				pushTrap(true, ta, tb, rDa, rDb, rRa, rRb);
				return;
			}
			if (fa >= 0 && fb >= 0) return;
			const denom = fb - fa;
			let tc = Math.abs(denom) > 1e-10 ? -fa / denom : 0.5;
			tc = Math.max(0, Math.min(1, tc));
			const tm = ta + tc * (tb - ta);
			const rDm = rDa + tc * (rDb - rDa);
			const rRm = rRa + tc * (rRb - rRa);
			if (tc > 1e-12 && fa < 0) pushTrap(true, ta, tm, rDa, rDm, rRa, rRm);
			if (tc < 1 - 1e-12 && fb < 0) pushTrap(true, tm, tb, rDm, rDb, rRm, rRb);
		}

		function addAboveSegment(ta, tb, rDa, rDb, rRa, rRb) {
			const ga = rDa - rRa;
			const gb = rDb - rRb;
			if (ga > 0 && gb > 0) {
				pushTrap(false, ta, tb, rDa, rDb, rRa, rRb);
				return;
			}
			if (ga <= 0 && gb <= 0) return;
			const denom = gb - ga;
			let tc = Math.abs(denom) > 1e-10 ? -ga / denom : 0.5;
			tc = Math.max(0, Math.min(1, tc));
			const tm = ta + tc * (tb - ta);
			const rDm = rDa + tc * (rDb - rDa);
			const rRm = rRa + tc * (rRb - rRa);
			if (tc > 1e-12 && ga > 0) pushTrap(false, ta, tm, rDa, rDm, rRa, rRm);
			if (tc < 1 - 1e-12 && gb > 0) pushTrap(false, tm, tb, rDm, rDb, rRm, rRb);
		}

		const baseSeg = denseSegCount(n);

		for (const arc of arcs) {
			const samples = wedgeMeanSamplesAlongPolyline(arc, n, rRef, rData, baseSeg);
			if (samples.length < 2) continue;
			for (let j = 0; j < samples.length - 1; j++) {
				const ta = samples[j].theta;
				const tb = samples[j + 1].theta;
				const rDa = samples[j].r;
				const rDb = samples[j + 1].r;
				const rRa = sampleRCyclic(ta, n, rRef);
				const rRb = sampleRCyclic(tb, n, rRef);

				addBelowSegment(ta, tb, rDa, rDb, rRa, rRb);
				addAboveSegment(ta, tb, rDa, rDb, rRa, rRb);
			}
		}

		return {
			pathBelow: belowParts.join(' '),
			pathAbove: aboveParts.join(' ')
		};
	}

	/**
	 * Open polyline for one subscale: ref at wedge angles t0 → statement means i0..i1 → ref at t1 (local coords).
	 * @param {{ fundModel: string, itemMeans: (number|null)[] }} m
	 * @param {{ i0: number, i1: number, t0: number, t1: number }} arc
	 * @param {number[]} rRefArr
	 */
	function subscaleMeanPolylinePathLocalD(m, arc, rRefArr) {
		const n = layout.n;
		if (!n || arc.i1 < arc.i0) return '';
		const rData = [];
		for (let i = 0; i < n; i++) rData.push(effectiveRForModelAt(m, i));
		const pts = wedgeMeanPointsLocalXY(arc, n, rRefArr, rData);
		return subscaleMeanLineOpen(pts) ?? '';
	}

	function statementSpikeHalfAngle(n) {
		if (!n) return 0.06;
		// half-step is TAU/n/2. Debate mode uses a much narrower spike (~1/3 width).
		const widthFactor = isDebateMode ? 0.33 : 1;
		const halfStep = TAU / n / 2;
		return Math.max(0.006, Math.min(0.14, widthFactor * halfStep));
	}

	function statementSpikePointsLocalXY(i, rRefArr, rDataArr) {
		const n = layout.n;
		if (!n) return [];
		const ang = layout.angles[i];
		const rr = rRefArr[i] ?? sampleRCyclic(ang, n, rRefArr);
		const halfByScale = statementSpikeHalfAngle(n);
		// Debate mode target: ~20px base width (half-width 10px) at baseline radius.
		const halfByPixels = 10 / Math.max(1, rr);
		const half = isDebateMode ? Math.max(0.0015, halfByPixels) : halfByScale;
		const rd = rDataArr[i] ?? rr;
		/** @type {[number, number][]} */
		const pts = [];
		pts.push(ptLocalPolar(rr, ang - half));
		pts.push(ptLocalPolar(rd, ang));
		pts.push(ptLocalPolar(rr, ang + half));
		return pts;
	}

	function statementSpikeStrokePathLocalD(i, rRefArr, rDataArr) {
		const pts = statementSpikePointsLocalXY(i, rRefArr, rDataArr);
		if (pts.length < 2) return '';
		return subscaleMeanLineOpen(pts) ?? '';
	}

	function debateSpikeTrianglePathLocalD(i, rBase, rTip) {
		const n = layout.n;
		if (!n) return '';
		const ang = layout.angles[i];
		const half = Math.max(0.0015, 10 / Math.max(1, rBase)); // ~20px base width
		const pL = ptLocalPolar(rBase, ang - half);
		const pT = ptLocalPolar(rTip, ang);
		const pR = ptLocalPolar(rBase, ang + half);
		return `M ${pL[0]} ${pL[1]} L ${pT[0]} ${pT[1]} L ${pR[0]} ${pR[1]} Z`;
	}

	/**
	 * Deviation clips per statement: each statement becomes its own spike vs baseline rRef[i].
	 * Output is a union of trapezoids (clip-path friendly), split into above vs below.
	 */
	function deviationSpikePathsPerStatementD(n, rRef, rData) {
		/** @type {string[]} */
		const belowParts = [];
		/** @type {string[]} */
		const aboveParts = [];

		/** @param {boolean} isBelow */
		function pushTrap(isBelow, t0, t1, rd0, rd1, rr0, rr1) {
			const [iax, iay] = ptLocalPolar(isBelow ? rd0 : rr0, t0);
			const [ibx, iby] = ptLocalPolar(isBelow ? rd1 : rr1, t1);
			const [obx, oby] = ptLocalPolar(isBelow ? rr1 : rd1, t1);
			const [oax, oay] = ptLocalPolar(isBelow ? rr0 : rd0, t0);
			const part = `M ${iax} ${iay} L ${ibx} ${iby} L ${obx} ${oby} L ${oax} ${oay} Z`;
			(isBelow ? belowParts : aboveParts).push(part);
		}

		function addBelowSegment(ta, tb, rDa, rDb, rR) {
			const fa = rDa - rR;
			const fb = rDb - rR;
			if (fa < 0 && fb < 0) {
				pushTrap(true, ta, tb, rDa, rDb, rR, rR);
				return;
			}
			if (fa >= 0 && fb >= 0) return;
			const denom = fb - fa;
			let tc = Math.abs(denom) > 1e-10 ? -fa / denom : 0.5;
			tc = Math.max(0, Math.min(1, tc));
			const tm = ta + tc * (tb - ta);
			const rDm = rDa + tc * (rDb - rDa);
			if (tc > 1e-12 && fa < 0) pushTrap(true, ta, tm, rDa, rDm, rR, rR);
			if (tc < 1 - 1e-12 && fb < 0) pushTrap(true, tm, tb, rDm, rDb, rR, rR);
		}

		function addAboveSegment(ta, tb, rDa, rDb, rR) {
			const ga = rDa - rR;
			const gb = rDb - rR;
			if (ga > 0 && gb > 0) {
				pushTrap(false, ta, tb, rDa, rDb, rR, rR);
				return;
			}
			if (ga <= 0 && gb <= 0) return;
			const denom = gb - ga;
			let tc = Math.abs(denom) > 1e-10 ? -ga / denom : 0.5;
			tc = Math.max(0, Math.min(1, tc));
			const tm = ta + tc * (tb - ta);
			const rDm = rDa + tc * (rDb - rDa);
			if (tc > 1e-12 && ga > 0) pushTrap(false, ta, tm, rDa, rDm, rR, rR);
			if (tc < 1 - 1e-12 && gb > 0) pushTrap(false, tm, tb, rDm, rDb, rR, rR);
		}

		for (let i = 0; i < n; i++) {
			const rr = rRef[i];
			const pts = statementSpikePointsLocalXY(i, rRef, rData);
			if (pts.length < 2) continue;
			const segs = recordLineSegmentsWithCurve(pts, meanLineCurve);
			const samples = samplePathSegmentsToPolar(segs, 24);
			if (samples.length < 2) continue;
			for (let j = 0; j < samples.length - 1; j++) {
				const ta = samples[j].theta;
				const tb = samples[j + 1].theta;
				const rDa = samples[j].r;
				const rDb = samples[j + 1].r;
				addBelowSegment(ta, tb, rDa, rDb, rr);
				addAboveSegment(ta, tb, rDa, rDb, rr);
			}
		}

		return {
			pathBelow: belowParts.join(' '),
			pathAbove: aboveParts.join(' ')
		};
	}

	/**
	 * Convergence view: per-statement overlap (grey) + per-model overhangs (model colors).
	 * Missing means are treated as baseline via `effectiveRForModelAt`.
	 */
	const spikeIndexList = $derived.by(() => Array.from({ length: layout.n }, (_, i) => i));

	const spikeRDataByModel = $derived.by(() => {
		const n = layout.n;
		/** @type {Map<string, number[]>} */
		const map = new Map();
		if (!n || !visibleModelSeries.length) return map;
		for (const s of visibleModelSeries) {
			const arr = [];
			for (let i = 0; i < n; i++) arr.push(effectiveRForModelAt(s, i));
			map.set(s.fundModel, arr);
		}
		return map;
	});

	const spikeRDataByModelAll = $derived.by(() => {
		const n = layout.n;
		/** @type {Map<string, number[]>} */
		const map = new Map();
		if (!n || !viz?.modelSeries?.length) return map;
		for (const s of viz.modelSeries) {
			const arr = [];
			for (let i = 0; i < n; i++) arr.push(effectiveRForModelAt(s, i));
			map.set(s.fundModel, arr);
		}
		return map;
	});

	/**
	 * Sample a single statement spike curve in local XY, given baseline radius and tip radius.
	 * @returns {[number, number][]}
	 */
	function sampleStatementSpikeCurveXY(i, rBase, rTip, budget = 22) {
		const n = layout.n;
		if (!n) return [];
		const ang = layout.angles[i];
		const half = statementSpikeHalfAngle(n);
		const pts = [ptLocalPolar(rBase, ang - half), ptLocalPolar(rTip, ang), ptLocalPolar(rBase, ang + half)];
		const segs = recordLineSegmentsWithCurve(pts, meanLineCurve);
		/** @type {[number, number][]} */
		const out = [];
		let px = 0;
		let py = 0;
		let started = false;
		for (const s of segs) {
			if (s.kind === 'M') {
				px = s.x;
				py = s.y;
				started = true;
				out.push([px, py]);
				continue;
			}
			if (!started) continue;
			if (s.kind === 'L') {
				const x1 = s.x;
				const y1 = s.y;
				for (let k = 1; k <= budget; k++) {
					const t = k / budget;
					out.push([px + t * (x1 - px), py + t * (y1 - py)]);
				}
				px = x1;
				py = y1;
			} else if (s.kind === 'C') {
				const x0 = px;
				const y0 = py;
				const cp1x = s.x1 ?? x0;
				const cp1y = s.y1 ?? y0;
				const cp2x = s.x2 ?? x0;
				const cp2y = s.y2 ?? y0;
				const x3 = s.x;
				const y3 = s.y;
				for (let k = 1; k <= budget; k++) {
					const t = k / budget;
					const omt = 1 - t;
					const x =
						omt * omt * omt * x0 +
						3 * omt * omt * t * cp1x +
						3 * omt * t * t * cp2x +
						t * t * t * x3;
					const y =
						omt * omt * omt * y0 +
						3 * omt * omt * t * cp1y +
						3 * omt * t * t * cp2y +
						t * t * t * y3;
					out.push([x, y]);
				}
				px = x3;
				py = y3;
			}
		}
		return out;
	}

	function pathFromXY(points) {
		if (!points.length) return '';
		let d = `M ${points[0][0]} ${points[0][1]}`;
		for (let i = 1; i < points.length; i++) d += ` L ${points[i][0]} ${points[i][1]}`;
		return d + ' Z';
	}

	function stripPathBetweenCurves(outerPts, innerPts) {
		if (!outerPts.length || !innerPts.length) return '';
		let d = `M ${outerPts[0][0]} ${outerPts[0][1]}`;
		for (let i = 1; i < outerPts.length; i++) d += ` L ${outerPts[i][0]} ${outerPts[i][1]}`;
		for (let i = innerPts.length - 1; i >= 0; i--) d += ` L ${innerPts[i][0]} ${innerPts[i][1]}`;
		return d + ' Z';
	}

	const convergenceByStatementAll = $derived.by(() => {
		const n = layout.n;
		if (!n || !viz?.modelSeries?.length) return [];
		const models = viz.modelSeries.map((s) => s.fundModel);
		const canFormConsensus = models.length > 1;
		/** @type {{ i: number, rBase: number, sharedTip: number|null }[]} */
		const out = [];
		for (let i = 0; i < n; i++) {
			const rBase = meanPathRefRadii[i];
			let allAbove = true;
			let allBelow = true;
			let minR = Infinity;
			let maxR = -Infinity;
			for (const m of models) {
				const arr = spikeRDataByModelAll.get(m) ?? [];
				const r = arr[i] ?? rBase;
				if (r <= rBase + 1e-6) allAbove = false;
				if (r >= rBase - 1e-6) allBelow = false;
				minR = Math.min(minR, r);
				maxR = Math.max(maxR, r);
			}
			let sharedTip = null;
			if (canFormConsensus) {
				if (allAbove) sharedTip = minR;
				else if (allBelow) sharedTip = maxR;
			}
			out.push({ i, rBase, sharedTip });
		}
		return out;
	});

	const convergenceByStatement = $derived.by(() => {
		const n = layout.n;
		if (!n || !visibleModelSeries.length) return [];
		const models = visibleModelSeries.map((s) => s.fundModel);
		const canFormConsensus = models.length > 1;
		/** @type {{ i: number, rBase: number, sharedTip: number|null, allAbove: boolean, allBelow: boolean, rByModel: Map<string, number> }[]} */
		const out = [];
		for (let i = 0; i < n; i++) {
			const rBase = meanPathRefRadii[i];
			let allAbove = true;
			let allBelow = true;
			let minR = Infinity;
			let maxR = -Infinity;
			/** @type {Map<string, number>} */
			const rByModel = new Map();
			for (const m of models) {
				const arr = spikeRDataByModel.get(m) ?? [];
				const r = arr[i] ?? rBase;
				rByModel.set(m, r);
				if (r <= rBase + 1e-6) allAbove = false;
				if (r >= rBase - 1e-6) allBelow = false;
				minR = Math.min(minR, r);
				maxR = Math.max(maxR, r);
			}
			let sharedTip = null;
			if (canFormConsensus) {
				if (allAbove) sharedTip = minR;
				else if (allBelow) sharedTip = maxR;
			}
			out.push({ i, rBase, sharedTip, allAbove, allBelow, rByModel });
		}
		return out;
	});

	const isolatedModelSeries = $derived(singleVisibleModel);

	const isolatedModelRData = $derived.by(() => {
		const n = layout.n;
		if (!n || !isolatedModelSeries) return /** @type {number[]} */ ([]);
		const out = [];
		for (let i = 0; i < n; i++) out.push(effectiveRForModelAt(isolatedModelSeries, i));
		return out;
	});

	/**
	 * Grey consensus + colored spikes. Colored paths sorted by descending radial extent (largest drawn first = bottom).
	 */
	const convergenceFillLayers = $derived.by(() => {
		/** @type {{ d: string, key: string, statementIndex: number }[]} */
		const greyPaths = [];
		/** @type {{ d: string, fill: string, key: string, area: number, statementIndex: number }[]} */
		const coloredPaths = [];

		if (!layout.n || !visibleModelSeries.length || !convergenceByStatement.length) {
			return { greyPaths, coloredPaths };
		}

		for (const st of convergenceByStatementAll) {
			if (st.sharedTip !== null && Math.abs(st.sharedTip - st.rBase) > 1e-6) {
				const sharedPts = sampleStatementSpikeCurveXY(st.i, st.rBase, st.sharedTip);
				const dShared = pathFromXY(sharedPts);
				if (dShared) greyPaths.push({ d: dShared, key: `grey-${st.i}`, statementIndex: st.i });
			}
		}

		for (const st of convergenceByStatement) {
			for (const ms of visibleModelSeries) {
				const r = st.rByModel.get(ms.fundModel) ?? st.rBase;
				if (Math.abs(r - st.rBase) <= 1e-6) continue;
				const pts = sampleStatementSpikeCurveXY(st.i, st.rBase, r);
				const dSpikeFill = pathFromXY(pts);
				if (dSpikeFill) {
					coloredPaths.push({
						d: dSpikeFill,
						fill: modelColor(ms.fundModel),
						key: `${st.i}-${ms.fundModel}-full`,
						area: Math.abs(r - st.rBase),
						statementIndex: st.i
					});
				}
			}
		}

		coloredPaths.sort((a, b) => b.area - a.area);
		return { greyPaths, coloredPaths };
	});

	const spikeHoverTargets = $derived.by(() => {
		if (!layout.n || !visibleModelSeries.length || !meanPathRefRadii.length) return [];
		/** @type {{ key: string, d: string, model: string, item: object, responseText: string, statementIndex: number }[]} */
		const targets = [];
		for (const model of visibleModelSeries) {
			const rData = [];
			for (let i = 0; i < layout.n; i++) rData.push(effectiveRForModelAt(model, i));
			for (let i = 0; i < layout.n; i++) {
				const value = model.itemMeans?.[i];
				if (value === null || value === undefined || Number.isNaN(value)) continue;
				const d = statementSpikeStrokePathLocalD(i, meanPathRefRadii, rData);
				if (!d) continue;
				const item = viz.dim.items[i];
				const responseText = scaleTextForValue(
					value,
					Array.isArray(item?.statement_scale) ? item.statement_scale : [],
					Number(item?.scaleMin),
					Number(item?.scaleMax),
					Boolean(item?.reverse)
				);
				targets.push({
					key: `${model.fundModel}-${item?.item_id ?? i}`,
					d,
					model: model.fundModel,
					item,
					responseText,
					statementIndex: i
				});
			}
		}
		return targets;
	});

	/**
	 * @param {MouseEvent} event
	 * @param {string} model
	 * @param {object} item
	 * @param {string} responseText
	 */
	function setDotHover(event, model, item, responseText) {
		const shell = event.currentTarget?.closest?.('.radial-chart-shell');
		if (!shell) return;
		const shellRect = shell.getBoundingClientRect();
		const xInShell = event.clientX - shellRect.left;
		const yInShell = event.clientY - shellRect.top;

		const W = RADIAL_TOOLTIP_W;
		const offset = 14;
		/** Past horizontal midline of chart shell → show tooltip to the left of cursor. */
		const placeLeft = xInShell > shellRect.width / 2;

		let x;
		if (placeLeft) {
			x = xInShell - offset;
			x = Math.min(x, shellRect.width - TOOLTIP_PAD);
			x = Math.max(x, W + TOOLTIP_PAD);
		} else {
			x = xInShell + offset;
			x = Math.max(x, TOOLTIP_PAD);
			x = Math.min(x, shellRect.width - W - TOOLTIP_PAD);
		}

		let y = yInShell - RADIAL_TOOLTIP_EST_H / 2;
		y = Math.max(
			TOOLTIP_PAD,
			Math.min(shellRect.height - RADIAL_TOOLTIP_EST_H - TOOLTIP_PAD, y)
		);

		const allModelsMode = !isSingleVisibleModel;

		tooltip = {
			kind: 'dot',
			x,
			y,
			placeLeft,
			allModelsMode,
			model,
			statementText: statementLabel(item),
			responseText: responseText || ''
		};
	}

	function clearDotHover() {
		tooltip = null;
	}

	/** @param {MouseEvent | KeyboardEvent} event */
	/** @param {object} item */
	function handleSpikeClick(event, item) {
		if (!statementSelectEnabled) return;
		event.preventDefault();
		event.stopPropagation();
		const id = item?.item_id;
		if (id == null || String(id).trim() === '') return;
		onStatementSelect(String(id));
	}

	/** @param {string} subscaleKey */
	function handleSubscaleWedgeClick(subscaleKey) {
		onSubscaleWedgeClick(subscaleKey);
	}

	/** @param {number} t */
	function radialLabelAnchor(t) {
		const c = Math.cos(t);
		if (c > 0.25) return 'start';
		if (c < -0.25) return 'end';
		return 'middle';
	}

	/** Tension title only — upper-left: start, upper-right: end, lower spoke: middle. */
	function debateTensionTitleAnchor(t) {
		if (Math.sin(t) >= -0.02) return 'middle';
		return Math.cos(t) < 0 ? 'start' : 'end';
	}

	/**
	 * Rotation (degrees) so label reads along the spoke; flip when it would render upside-down.
	 * @param {number} t — spoke angle (rad)
	 */
	function debatePoleLabelRotateDeg(t) {
		let deg = (t * 180) / Math.PI;
		deg = ((deg % 360) + 360) % 360;
		if (deg > 90 && deg < 270) deg -= 180;
		return deg;
	}

	/**
	 * Debate pole + tension title radii (px from center along each spoke).
	 * Inner label sits inward of spikes; outer label just past spike tips; tension title farther out.
	 * @param {{ spikeRangeInner: number, spikeRangeOuter: number, hubR: number, cx: number, cy: number }} L
	 */
	function debateRadialLabelRadii(L) {
		const compact = Math.min(width, height) < 520;
		const si = L.spikeRangeInner;
		const so = L.spikeRangeOuter;
		const hub = L.hubR;
		const rIn = Math.max(hub + 10, si - 26);
		const rOut = so + 24;
		const lr = so + (compact ? 62 : 84);
		return { rIn, rOut, lr, axisLabelGap: compact ? 16 : 24 };
	}

	/**
	 * Nudge tension titles off the spoke tip so the top pair do not collide.
	 * @param {number} i
	 * @param {number} n
	 * @param {number} t — spoke angle (rad)
	 */
	function debateTensionLabelOffset(i, n, t) {
		const compact = Math.min(width, height) < 520;
		if (n === 3) {
			if (i === 0) return { dx: 0, dy: compact ? 4 : 12 };
			if (i === 1) return { dx: compact ? -10 : -14, dy: compact ? -8 : -12 };
			if (i === 2) return { dx: compact ? 10 : 14, dy: compact ? -8 : -12 };
		}
		const c = Math.cos(t);
		const s = Math.sin(t);
		const spread = Math.min(width, height) < 520 ? 10 : 14;
		return { dx: c * spread, dy: s * spread };
	}

	/**
	 * Keep tension titles inside the SVG viewport on narrow screens.
	 * @param {number} cx
	 * @param {number} cy
	 * @param {number} w
	 * @param {number} h
	 * @param {number} t
	 * @param {number} lr
	 * @param {number} minR
	 * @param {number} [textMargin]
	 */
	function clampDebateTensionLabelRadius(cx, cy, w, h, t, lr, minR, textMargin = 52) {
		const c = Math.cos(t);
		const s = Math.sin(t);
		let maxR = lr;
		if (c > 0.02) maxR = Math.min(maxR, (w - textMargin - cx) / c);
		if (c < -0.02) maxR = Math.min(maxR, (textMargin - cx) / -c);
		if (s > 0.02) maxR = Math.min(maxR, (h - textMargin - cy) / s);
		if (s < -0.02) maxR = Math.min(maxR, (textMargin - cy) / -s);
		return Math.max(minR, maxR);
	}

	/**
	 * Axis segments with gaps so lines do not cross pole or tension labels.
	 * @param {{ spikeRangeInner: number, spikeRangeOuter: number, hubR: number, cx: number, cy: number }} L
	 * @param {number} t
	 */
	function debateAxisLineSegments(L, t) {
		const { rIn, rOut, lr, axisLabelGap: g } = debateRadialLabelRadii(L);
		const lrTension = lr;
		const hub = L.hubR;
		const c = Math.cos(t);
		const s = Math.sin(t);
		const { cx, cy } = L;
		const seg = (rFrom, rTo) => ({
			x1: cx + rFrom * c,
			y1: cy + rFrom * s,
			x2: cx + rTo * c,
			y2: cy + rTo * s
		});
		const rLineStart = hub + 4;
		const r1 = Math.max(rLineStart + 2, rIn - g);
		const r2 = rIn + g;
		const r3 = rOut - g;
		const r4 = rOut + g;
		const r5 = Math.max(r4 + 2, lrTension - g);
		/** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
		const parts = [];
		if (r1 > rLineStart + 0.5) parts.push(seg(rLineStart, r1));
		if (r3 > r2 + 0.5) parts.push(seg(r2, r3));
		if (r5 > r4 + 0.5) parts.push(seg(r4, r5));
		return parts;
	}

	/** @param {number} i */
	function debateAxisLabel(i) {
		const raw = Array.isArray(debatePrimaryTensions) ? debatePrimaryTensions[i] : '';
		const s = String(raw ?? '').trim();
		const label = s || `Question ${i + 1}`;
		return label
			.split(/[\s_-]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * High/low wording along the spoke: inner ≈ scale min, outer ≈ scale max (swap when `reverse`, like averages JSON).
	 * @param {number} i
	 */
	function debateAxisPoleLabelPair(i) {
		const item = viz?.dim?.items?.[i];
		if (!item) return { inner: '', outer: '' };
		const rev = Boolean(item.reverse);
		const lo = String(
			item.statement_values?.min ?? item.dimStatementValues?.min ?? ''
		).trim();
		const hi = String(
			item.statement_values?.max ?? item.dimStatementValues?.max ?? ''
		).trim();
		if (!lo && !hi) return { inner: '', outer: '' };
		const inner = rev ? hi : lo;
		const outer = rev ? lo : hi;
		return { inner, outer };
	}

	/**
	 * Debate-label hover mirrors spike hover (statement + model response tooltip).
	 * Uses selected model when single-selected; otherwise first visible model.
	 * @param {MouseEvent} event
	 * @param {number} i
	 */
	function setDebateLabelHover(event, i) {
		if (!layout.n || !viz?.dim?.items?.[i] || !visibleModelSeries.length) return;
		const modelSeries =
			isSingleVisibleModel && singleVisibleModel ? singleVisibleModel : visibleModelSeries[0];
		if (!modelSeries) return;
		const value = modelSeries.itemMeans?.[i];
		const item = viz.dim.items[i];
		const responseText = scaleTextForValue(
			value,
			Array.isArray(item?.statement_scale) ? item.statement_scale : [],
			Number(item?.scaleMin),
			Number(item?.scaleMax),
			Boolean(item?.reverse)
		);
		setDotHover(event, modelSeries.fundModel, item, responseText || '');
	}

	/**
	 * Debate label click mirrors spike selection behavior.
	 * @param {MouseEvent | KeyboardEvent} event
	 * @param {number} i
	 */
	function handleDebateLabelClick(event, i) {
		const item = viz?.dim?.items?.[i];
		if (!item) return;
		handleSpikeClick(event, item);
	}

	const debateRadarLayers = $derived.by(() => {
		/** @type {{ key: string, d: string, color: string }[]} */
		const out = [];
		if (!isDebateMode || !layout.n || !visibleModelSeries.length) return out;
		for (const ms of visibleModelSeries) {
			const pts = [];
			for (let i = 0; i < layout.n; i++) {
				const r = effectiveRForModelAt(ms, i);
				const t = layout.angles[i];
				pts.push([r * Math.cos(t), r * Math.sin(t)]);
			}
			if (!pts.length) continue;
			let d = `M ${pts[0][0]} ${pts[0][1]}`;
			for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
			d += ' Z';
			out.push({ key: `debate-radar-${ms.fundModel}`, d, color: modelColor(ms.fundModel) });
		}
		return out;
	});

const debateRadarFillOpacity = $derived.by(() => {
	// Keep radar area fills only when 1-2 models are visible; otherwise remove fill for readability.
	return visibleModelSeries.length <= 2 ? 0.2 : 0;
});

	const debateSpikeLayers = $derived.by(() => {
		/** @type {{ key: string, d: string, fill: string, statementIndex: number, mag: number }[]} */
		const out = [];
		if (!isDebateMode || !layout.n || !visibleModelSeries.length) return out;
		for (const ms of visibleModelSeries) {
			for (const st of convergenceByStatement) {
				const r = st.rByModel.get(ms.fundModel) ?? st.rBase;
				const mag = Math.abs(r - st.rBase);
				if (mag <= 1e-6) continue;
				const d = debateSpikeTrianglePathLocalD(st.i, st.rBase, r);
				if (!d) continue;
				out.push({
					key: `debate-spike-${st.i}-${ms.fundModel}`,
					d,
					fill: modelColor(ms.fundModel),
					statementIndex: st.i,
					mag
				});
			}
		}
		// Larger spikes first; shorter ones last so they stay visible on top.
		out.sort((a, b) => {
			if (a.statementIndex !== b.statementIndex) return a.statementIndex - b.statementIndex;
			return b.mag - a.mag;
		});
		return out;
	});

	/** One wide wedge per debate spoke — reliable tap target on mobile (replaces per-model spike strokes). */
	const debateSpokeHitTargets = $derived.by(() => {
		if (!statementSelectEnabled || !isDebateMode || !layout?.n) return [];
		/** @type {{ key: string, d: string, item: object, statementIndex: number }[]} */
		const targets = [];
		const tau = 2 * Math.PI;
		const wedgeFraction = 0.9;
		for (let i = 0; i < layout.n; i++) {
			const item = viz.dim.items[i];
			if (!item) continue;
			const t = layout.angles[i];
			const halfWedge = tau / layout.n / 2;
			const t0 = t - halfWedge * wedgeFraction;
			const t1 = t + halfWedge * wedgeFraction;
			const rInner = layout.hubR;
			const rOuter = layout.spikeRangeOuter + (hideSubscaleLabels ? 24 : 32);
			targets.push({
				key: `debate-spoke-${i}`,
				d: annularSectorPathD(0, 0, rInner, rOuter, t0, t1),
				item,
				statementIndex: i
			});
		}
		return targets;
	});

	/** Suppress duplicate click after touchend on debate targets. */
	let debateTouchSelectAt = 0;

	/**
	 * @param {MouseEvent | TouchEvent | KeyboardEvent} event
	 * @param {number} i
	 */
	function handleDebatePointerSelect(event, i) {
		if (event.type === 'touchend') {
			event.preventDefault();
			debateTouchSelectAt = Date.now();
			handleDebateLabelClick(event, i);
			return;
		}
		if (event.type === 'click' && Date.now() - debateTouchSelectAt < 400) return;
		handleDebateLabelClick(event, i);
	}

	/**
	 * @param {MouseEvent | TouchEvent | KeyboardEvent} event
	 * @param {object} item
	 */
	function handleDebateSpokePointerSelect(event, item) {
		if (event.type === 'touchend') {
			event.preventDefault();
			debateTouchSelectAt = Date.now();
			handleSpikeClick(event, item);
			return;
		}
		if (event.type === 'click' && Date.now() - debateTouchSelectAt < 400) return;
		handleSpikeClick(event, item);
	}
</script>

{#if !viz || !layout.n}
	<p class="text-sm text-slate-500">No data.</p>
{:else}
	<div class="radial-chart-shell">
		<div class="radial-svg-slot">
			<svg
				width={width}
				height={height}
				class="radial-interactive-svg block max-h-full max-w-full shrink-0"
				style="overflow: visible"
				role="img"
				aria-label="Radial chart of model convergence by statement."
				focusable="false"
				onmouseleave={clearSubscaleHoverKey}
			>
			<defs>
				<clipPath id="radial-plot-disc-clip">
					<circle
						cx={layout.cx}
						cy={layout.cy}
						r={layout.fullOuterR + DISC_CLIP_OUTSET}
					/>
				</clipPath>
				{#each layout.subscaleArcs as arc (arc.id)}
					<path id={arc.id} d={arc.textPathD} fill="none" />
				{/each}
				<!-- Selected-subscale high/low pole label paths — restore with `focusedSubscalePoleLabels` + `.subscale-pole-label` group
				{#if focusedSubscalePoleLabels}
					{#if focusedSubscalePoleLabels.twoPoles}
						<path id="radial-pole-outer" d={focusedSubscalePoleLabels.outerPathD} fill="none" />
						<path id="radial-pole-inner" d={focusedSubscalePoleLabels.innerPathD} fill="none" />
					{:else}
						<path id="radial-pole-single" d={focusedSubscalePoleLabels.singlePathD} fill="none" />
					{/if}
				{/if}
				-->
			</defs>

			<g clip-path="url(#radial-plot-disc-clip)">
				<!-- Inner hub: same grey as column chrome / wedge separators -->
				<circle
					cx={layout.cx}
					cy={layout.cy}
					r={layout.hubR}
					fill={HUB_FILL}
					aria-hidden="true"
				/>

				{#if !isDebateMode}
					<!-- Neutral reference circle: midpoint of value scale (spike baseline / ref radius). -->
					<circle
						cx={layout.cx}
						cy={layout.cy}
						r={(layout.spikeRangeInner + layout.spikeRangeOuter) / 2}
						fill="none"
						stroke={DIMENSION_RING_FILL}
						stroke-width={SUBSCALE_RIM_WIDTH}
						aria-hidden="true"
						pointer-events="none"
					/>
				{/if}

				{#if isDebateMode}
					<g aria-hidden="true" class="debate-axis-grid" pointer-events="none">
						{#each spikeIndexList as i (`debate-axis-${i}`)}
							{@const t = layout.angles[i]}
							{#each debateAxisLineSegments(layout, t) as seg, segIdx (`debate-axis-seg-${i}-${segIdx}`)}
								<line
									x1={seg.x1}
									y1={seg.y1}
									x2={seg.x2}
									y2={seg.y2}
									stroke="#cecece"
									stroke-width="1"
								/>
							{/each}
						{/each}
					</g>
				{/if}

				{#if isDebateMode}
					{#if layout.n && debateRadarLayers.length}
						<g
							transform="translate({layout.cx},{layout.cy})"
							class="debate-radar-fills"
							aria-hidden="true"
							pointer-events="none"
						>
							{#each debateRadarLayers as layer (layer.key)}
								<path
									d={layer.d}
									fill={layer.color}
									fill-opacity={debateRadarFillOpacity}
									stroke={layer.color}
									stroke-width="2"
								/>
							{/each}
							{#each debateSpikeLayers as p (p.key)}
								<path
									d={p.d}
									fill={p.fill}
									fill-opacity={opacityForStatementIndex(p.statementIndex)}
									stroke={p.fill}
									stroke-width="1.5"
									stroke-opacity={0.95 * opacityForStatementIndex(p.statementIndex)}
								/>
							{/each}
						</g>
					{/if}
				{:else if layout.n && visibleModelSeries.length && convergenceFillLayers.coloredPaths.length + convergenceFillLayers.greyPaths.length > 0}
					<g
						transform="translate({layout.cx},{layout.cy})"
						class="model-convergence-fills"
						aria-hidden="true"
						pointer-events="none"
					>
						{#each convergenceFillLayers.coloredPaths as p (p.key)}
							<path d={p.d} fill={p.fill} opacity={opacityForStatementIndex(p.statementIndex)} />
						{/each}
						{#each convergenceFillLayers.greyPaths as g (g.key)}
							<path
								d={g.d}
								fill="#cecece"
								fill-opacity="1"
								opacity={opacityForStatementIndex(g.statementIndex)}
							/>
						{/each}
					</g>
				{/if}

				<!-- Hover + click targets for statement spikes (full radial only; debate uses spoke wedges). -->
				{#if !isDebateMode && statementSelectEnabled}
				<g transform="translate({layout.cx},{layout.cy})" class="spike-hit-targets">
					{#each spikeHoverTargets as t (t.key)}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<path
							d={t.d}
							fill="none"
							stroke="transparent"
							stroke-width="13"
							stroke-linecap="round"
							stroke-linejoin="round"
							opacity={opacityForStatementIndex(t.statementIndex)}
							role="button"
							tabindex="0"
							aria-label={`Select statement: ${statementLabel(t.item)}`}
							onmouseenter={(event) => setDotHover(event, t.model, t.item, t.responseText)}
							onmousemove={(event) => setDotHover(event, t.model, t.item, t.responseText)}
							onmouseleave={clearDotHover}
							onclick={(event) => handleSpikeClick(event, t.item)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleSpikeClick(event, t.item);
								}
							}}
						/>
					{/each}
				</g>
				{/if}

				{#if isDebateMode && statementSelectEnabled}
					<g transform="translate({layout.cx},{layout.cy})" class="debate-spoke-hit-targets">
						{#each debateSpokeHitTargets as t (t.key)}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<path
								d={t.d}
								fill="transparent"
								role="button"
								tabindex="0"
								aria-label={`Select tension: ${debateAxisLabel(t.statementIndex)}`}
								class="debate-spoke-hit-target"
								onmouseenter={(event) => setDebateLabelHover(event, t.statementIndex)}
								onmousemove={(event) => setDebateLabelHover(event, t.statementIndex)}
								onmouseleave={clearDotHover}
								onclick={(event) => handleDebateSpokePointerSelect(event, t.item)}
								ontouchend={(event) => handleDebateSpokePointerSelect(event, t.item)}
								onkeydown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										handleSpikeClick(event, t.item);
									}
								}}
							/>
						{/each}
					</g>
				{/if}

				{#if showGroupingMarkers}
					<!-- Thin radials from hub to inner edge of the outer grey ring (plot / spike band). -->
					<g aria-hidden="true" class="subscale-plot-grid" pointer-events="none">
						{#if layout.subscaleArcs.length > 1}
							{#each layout.subscaleArcs as arc (arc.id)}
								{@const t = arc.t0}
								{@const x0 = layout.cx + layout.hubR * Math.cos(t)}
								{@const y0 = layout.cy + layout.hubR * Math.sin(t)}
								{@const x1 = layout.cx + layout.clipEdgeR * Math.cos(t)}
								{@const y1 = layout.cy + layout.clipEdgeR * Math.sin(t)}
								<line
									x1={x0}
									y1={y0}
									x2={x1}
									y2={y1}
									stroke={RADIAL_SPOKE_STROKE}
									stroke-width={SUBSCALE_SPOKE_WIDTH}
									stroke-linecap="butt"
								/>
							{/each}
						{/if}
					</g>

					<!-- Outer grey annulus: one sector per subscale (former dimension-ring styling). -->
					<g aria-hidden="true" class="subscale-ring-grid" pointer-events="none">
					{#if !hideSubscaleLabels}
						{#each layout.subscaleArcs as arc (arc.id)}
							<path
								d={annularSectorPathD(
									layout.cx,
									layout.cy,
									layout.dimensionInnerR,
									layout.fullOuterR,
									arc.t0,
									arc.t1
								)}
								fill={DIMENSION_RING_FILL}
								fill-opacity={DIMENSION_RING_OPACITY}
							/>
							<path
								d={geometricSectorArcD(
									layout.cx,
									layout.cy,
									layout.fullOuterR,
									arc.t0,
									arc.t1
								)}
								fill="none"
								stroke={subscaleHighlightLocked ? 'transparent' : DIMENSION_RING_SEPARATOR}
								stroke-width={SUBSCALE_RIM_WIDTH}
							/>
						{/each}
						{#each layout.subscaleArcs as arc (arc.id)}
							{@const t = arc.t0}
							{@const x0 = layout.cx + layout.dimensionInnerR * Math.cos(t)}
							{@const y0 = layout.cy + layout.dimensionInnerR * Math.sin(t)}
							{@const x1 = layout.cx + layout.fullOuterR * Math.cos(t)}
							{@const y1 = layout.cy + layout.fullOuterR * Math.sin(t)}
							<line
								x1={x0}
								y1={y0}
								x2={x1}
								y2={y1}
								stroke={subscaleHighlightLocked ? 'transparent' : DIMENSION_RING_SEPARATOR}
								stroke-width={DIMENSION_SPOKE_WIDTH}
								stroke-linecap="butt"
							/>
						{/each}
					{/if}
					</g>

					<g class="subscale-hit-targets">
						{#each layout.subscaleArcs as arc (arc.id)}
							<path
								d={annularSectorPathD(
									layout.cx,
									layout.cy,
									Math.max(layout.plotOuterR + 2, layout.hubR),
									layout.fullOuterR,
									arc.t0,
									arc.t1
								)}
								fill="transparent"
								role="presentation"
								onmouseenter={() =>
									setSubscaleHoverKey(viz.dim.items[arc.i0]?.subscaleKey ?? '__none__')}
								onmouseleave={clearSubscaleHoverKey}
							/>
						{/each}
					</g>
				{/if}
			</g>

			{#if centerCardLayout}
				<foreignObject
					x={centerCardLayout.x}
					y={centerCardLayout.y}
					width={centerCardLayout.cardW}
					height={centerCardLayout.cardH}
					aria-hidden="true"
					pointer-events="none"
				>
					<div xmlns="http://www.w3.org/1999/xhtml" class="radial-center-card">
						<div class="radial-center-card-title">{centerCardLayout.label}</div>
						{#if centerCardLayout.description}
							<p class="radial-center-card-description">{centerCardLayout.description}</p>
						{/if}
					</div>
				</foreignObject>
			{/if}

			<!-- Subscale names on the outer grey annulus (Dimension view, desktop-only). -->
			{#if showGroupingMarkers && !hideSubscaleLabels}
				<g aria-hidden="true" class="subscale-labels" pointer-events="none">
					{#each layout.subscaleArcs as arc (arc.id)}
						{#if shouldShowSubscaleOuterLabel(arc)}
							<text class="subscale-label-text" dominant-baseline="middle" pointer-events="none">
								<textPath href={`#${arc.id}`} startOffset="50%" text-anchor="middle">
									{arc.label}
								</textPath>
							</text>
						{/if}
					{/each}
				</g>
			{/if}

			{#if isDebateMode}
				{@const dr = debateRadialLabelRadii(layout)}
				<g
					class="debate-axis-labels"
					pointer-events={statementSelectEnabled ? 'auto' : 'none'}
				>
					{#each spikeIndexList as i (`debate-label-${i}`)}
						{@const t = layout.angles[i]}
						{@const cos = Math.cos(t)}
						{@const sin = Math.sin(t)}
						{@const lrTension = clampDebateTensionLabelRadius(
							layout.cx,
							layout.cy,
							width,
							height,
							t,
							dr.lr,
							layout.spikeRangeOuter + 12,
							hideSubscaleLabels ? 40 : 52
						)}
						{@const labelOff = debateTensionLabelOffset(i, layout.n, t)}
						{@const lx = layout.cx + lrTension * cos + labelOff.dx}
						{@const ly = layout.cy + lrTension * sin + labelOff.dy}
						{@const tensionTitleAnchor = debateTensionTitleAnchor(t)}
						<g>
							<text
								x={lx}
								y={ly}
								fill="#111827"
								font-size={hideSubscaleLabels ? 11 : 14}
								font-weight="700"
								letter-spacing="0.01em"
								text-anchor={tensionTitleAnchor}
								dominant-baseline="middle"
								pointer-events="none"
								class="debate-axis-label-text"
								aria-hidden={statementSelectEnabled ? 'true' : undefined}
							>
								{debateAxisLabel(i)}
							</text>
							{#if statementSelectEnabled}
								<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
								<circle
									cx={lx}
									cy={ly}
									r={hideSubscaleLabels ? 36 : 22}
									fill="transparent"
									role="button"
									tabindex="0"
									class="debate-axis-label-hit"
									aria-label={`Select tension: ${debateAxisLabel(i)}`}
									onmouseenter={(event) => setDebateLabelHover(event, i)}
									onmousemove={(event) => setDebateLabelHover(event, i)}
									onmouseleave={clearDotHover}
									onclick={(event) => handleDebatePointerSelect(event, i)}
									ontouchend={(event) => handleDebatePointerSelect(event, i)}
									onkeydown={(event) => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											handleDebateLabelClick(event, i);
										}
									}}
								/>
							{/if}
						</g>
					{/each}
				</g>
			{/if}
			<!--
			{#if focusedSubscalePoleLabels}
				<g aria-hidden="true" class="subscale-pole-labels" pointer-events="none">
					{#if focusedSubscalePoleLabels.twoPoles}
						<text class="subscale-pole-label" dominant-baseline="middle">
							<textPath href="#radial-pole-outer" startOffset="50%" text-anchor="middle">
								{focusedSubscalePoleLabels.outerText}
							</textPath>
						</text>
						<text class="subscale-pole-label" dominant-baseline="middle">
							<textPath href="#radial-pole-inner" startOffset="50%" text-anchor="middle">
								{focusedSubscalePoleLabels.innerText}
							</textPath>
						</text>
					{:else}
						<text class="subscale-pole-label" dominant-baseline="middle">
							<textPath href="#radial-pole-single" startOffset="50%" text-anchor="middle">
								{focusedSubscalePoleLabels.outerText}
							</textPath>
						</text>
					{/if}
				</g>
			{/if}
			-->
		</svg>
		</div>

		<!-- Radial sort toggle (Dimension / Divergence) — uncomment block to restore
		<div class="radial-sort-toggle" role="group" aria-label="Radial statement sort">
			<button
				type="button"
				class:active={radialSortMode === STATEMENT_ORDER_SUBSCALE}
				onclick={() => onRadialSortModeChange(STATEMENT_ORDER_SUBSCALE)}
			>
				Dimension
			</button>
			<button
				type="button"
				class:active={radialSortMode === STATEMENT_ORDER_DIVERGENCE}
				onclick={() => onRadialSortModeChange(STATEMENT_ORDER_DIVERGENCE)}
			>
				Divergence
			</button>
		</div>
		-->

		{#if tooltip?.kind === 'dot'}
			<VizTooltip
				x={tooltip.x}
				y={tooltip.y}
				fixedWidth={RADIAL_TOOLTIP_W}
				maxWidth={RADIAL_TOOLTIP_W}
				placeLeft={tooltip.placeLeft}
				variant={tooltip.allModelsMode ? 'radial-all' : 'radial-model'}
				statementText={tooltip.statementText}
				model={tooltip.model}
				responseText={tooltip.responseText}
			/>
		{/if}

		{#if !isDebateMode}
			{#if hideSubscaleLabels}
				<div class="radial-legend-toggle">
					<button
						type="button"
						class="legend-button"
						aria-label="Show radial legend"
						onclick={() => (legendOpen = !legendOpen)}
					>
						?
					</button>
					{#if legendOpen}
						<div class="legend-popover" role="dialog" aria-label="Radial chart legend">
							<button
								type="button"
								class="legend-close"
								aria-label="Close legend"
								onclick={() => (legendOpen = false)}
							>
								×
							</button>
							<img
								class="radial-legend-popover-img"
								src={RADIAL_LEGEND_SRC}
								alt="Radial chart legend"
								width="260"
								height="160"
							/>
						</div>
					{/if}
				</div>
			{:else}
				<img
					class="radial-legend-desktop"
					src={RADIAL_LEGEND_SRC}
					alt="Radial chart legend"
				/>
			{/if}
		{/if}
	</div>
{/if}

<style>
	/**
	 * Fills the radial grid cell (not just the SVG square) so absolute controls
	 * align to the column edge near the context rail.
	 */
	.radial-chart-shell {
		position: relative;
		height: 100%;
		width: 100%;
		min-height: 0;
		overflow: visible;
	}

	.radial-svg-slot {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.radial-interactive-svg {
		pointer-events: auto;
		overflow: visible;
	}

	.radial-legend-toggle {
		position: absolute;
		right: 8px;
		bottom: 8px;
		z-index: 10;
	}

	.legend-button {
		width: 28px;
		height: 28px;
		border-radius: 9999px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #0f172a;
		font-size: 16px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.15);
	}

	.legend-button:hover {
		background: #f1f5f9;
	}

	.legend-popover {
		position: absolute;
		right: 0;
		bottom: 40px;
		padding: 0px;
		padding-top: 32px;
		background: #ffffff;
		border-radius: 8px;
		box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
		max-width: min(320px, 80vw);
		z-index: 50;
		overflow: visible;
		height: 230px;
		width: 190px;
	}

	.legend-close {
		position: absolute;
		top: 10px;
		right: 18px;
		border: none;
		background: transparent;
		color: #64748b;
		font-size: 20px;
		cursor: pointer;
	}

	.spike-hit-targets path {
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	/* Outer subscale ring + labels: no text drag / I-beam; labels stay default arrow. */
	.subscale-ring-grid {
		user-select: none;
		-webkit-user-select: none;
	}

	.subscale-labels,
	.subscale-labels text {
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.subscale-hit-targets path {
		user-select: none;
		-webkit-user-select: none;
		cursor: default;
	}

	/* Pointer focus should not show the browser’s default focus ring on SVG paths. */
	.spike-hit-targets path:focus:not(:focus-visible) {
		outline: none;
	}

	/* Radial sort toggle styles — restore with the commented markup block above
	.radial-sort-toggle {
		position: absolute;
		right: 4px;
		top: 8px;
		left: auto;
		transform: none;
		z-index: 5;
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.92);
	}

	.radial-sort-toggle button {
		border: 0;
		background: transparent;
		color: #475569;
		font-size: 10px;
		font-weight: 600;
		line-height: 1;
		padding: 5px 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	.radial-sort-toggle button:hover {
		background: #f1f5f9;
	}

	.radial-sort-toggle button.active {
		background: #0f172a;
		color: #ffffff;
	}
	*/

	.subscale-label-text {
		fill: #ffffff;
		font-size: 10px;
		font-weight: 400;
		letter-spacing: 0.02em;
	}

	.debate-axis-label-text {
		pointer-events: none;
		user-select: none;
	}

	.debate-axis-label-hit,
	.debate-spoke-hit-target {
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.radial-center-card {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.96);
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
	}

	.radial-center-card-title {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.25;
		color: #0f172a;
	}

	.radial-center-card-description {
		margin: 0;
		font-size: 11px;
		line-height: 1.35;
		color: #475569;
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Restore with pole label markup
	.subscale-pole-label {
		fill: #475569;
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	*/

	/* Desktop / large chart: fixed legend in the shell corner (original layout). */
	.radial-legend-desktop {
		position: absolute;
		right: -40px;
		bottom: -20px;
		width: 200px;
		height: auto;
		z-index: 4;
		pointer-events: none;
		user-select: none;
	}

	/* Mobile popover image */
	.radial-legend-popover-img {
		display: block;
		width: 100%;
		max-width: min(300px, 75vw);
		height: auto;
	}
</style>
