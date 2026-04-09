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

	/** Pixels beyond outer label ring; keeps curved labels inside the clip. */
	const DISC_CLIP_OUTSET = 0;
	/** White ring between grey hub and inner end of value scale (spike bases). */
	const INNER_SCALE_WHITE_PAD = 14;
	/** Subscale wedge rims + wide radial separators (matches surrounding grey panels). */
	const WEDGE_BORDER_STROKE = '#ebebeb';
	const SUBSCALE_SPOKE_WIDTH = 1;
	const SUBSCALE_RIM_WIDTH = 1;
	const DIMENSION_SPOKE_WIDTH = 5;
	const DIMENSION_RING_FILL = '#8e8e8e';
	const DIMENSION_RING_SEPARATOR = '#ebebeb';
	const SELECTED_PATH_STROKE = '#0a0a0a';
	const INACTIVE_MODEL_PATH_STROKE = '#a8a29e';
	const SUBSCALE_LABEL_FONT_PX = 5;
	const SUBSCALE_LABEL_CHAR_PX = SUBSCALE_LABEL_FONT_PX * 0.6;
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

	/** @type {{ width: number, height: number, viz: Viz, selectedModel: (string|null), radialSortMode?: ('subscale'|'divergence'), onRadialSortModeChange?: ((mode: 'subscale'|'divergence') => void), highlightSubscaleKey?: (string|null), onSubscaleWedgeClick?: ((subscaleKey: string) => void) }} */
	let {
		width,
		height,
		viz,
		selectedModel,
		radialSortMode = STATEMENT_ORDER_SUBSCALE,
		onRadialSortModeChange = () => {},
		highlightSubscaleKey = null,
		onSubscaleWedgeClick = () => {}
	} = $props();
	const showGroupingMarkers = $derived(radialSortMode !== STATEMENT_ORDER_DIVERGENCE);

	const HIGHLIGHT_DIM_OPACITY = 0.0;

	/** When a subscale is highlighted from the context rail, dim other statements (all stay visible). */
	function opacityForStatementIndex(i) {
		if (
			highlightSubscaleKey === null ||
			highlightSubscaleKey === undefined ||
			highlightSubscaleKey === ''
		) {
			return 1;
		}
		const item = viz?.dim?.items?.[i];
		const k = String(item?.subscaleKey ?? '').trim() || '__none__';
		return k === highlightSubscaleKey ? 1 : HIGHLIGHT_DIM_OPACITY;
	}
	/** In divergence mode, spikes extend much farther — space that was label + dimension rings in dimension mode. */
	const DIVERGENCE_OUTER_R_PAD = 6;

	/**
	 * @type { { kind: 'dot', x: number, y: number, placeLeft: boolean, model: string, subscaleLabel: string, statementText: string, responseText: string }
	 *   | null }
	 */
	let tooltip = $state(null);

	/** Inset from SVG edge to plot (spokes use full usable side = min(w,h) − 2×PAD). */
	const PAD = 8;
	const TOOLTIP_PAD = 8;
	const TOOLTIP_MAX_W = 320;

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

	/**
	 * Widen pole text paths past the subscale wedge when needed so long strings fit on the inner ring.
	 * When a subscale is highlighted, overlapping adjacent sectors is acceptable (their labels are off).
	 *
	 * @param {number} t0
	 * @param {number} t1
	 * @param {number} innerR — inner pole arc radius (bottleneck for arc length)
	 * @param {string[]} texts
	 */
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
		const cy = height / 2;
		const side = Math.max(120, Math.min(width, height) - 2 * PAD);
		const fullOuterR = side / 2;
		const divergenceMode = radialSortMode === STATEMENT_ORDER_DIVERGENCE;

		let dimensionInnerR;
		let plotOuterR;
		let hubR;
		let scaleInnerR;
		let dimensionLabelR;

		if (divergenceMode) {
			/** Outer plot limit: nearly to clip circle (was label + dimension annuli in dimension mode). */
			plotOuterR = Math.max(28, fullOuterR - DIVERGENCE_OUTER_R_PAD);
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

		const angles = [];
		const rScales = [];
		for (let i = 0; i < n; i++) {
			angles.push(-Math.PI / 2 + (i / n) * 2 * Math.PI);
			const ext = viz.itemExtents[i] ?? [0, 1];
			rScales.push(d3.scaleLinear().domain(ext).range([scaleInnerR, plotOuterR]));
		}

		const items = viz.dim.items;
		const runs = subscaleRuns(items, n);
		const tau = 2 * Math.PI;
		const subscaleArcs = runs.map((run, idx) => {
			const t0 = -Math.PI / 2 + ((run.i0 - 0.5) / n) * tau;
			const t1 = -Math.PI / 2 + ((run.i1 + 0.5) / n) * tau;
			const mid = (t0 + t1) / 2;
			const label = run.label;
			const arcLenPx = sectorSpan(t0, t1) * dimensionLabelR;
			const estTextPx = String(label).trim().length * SUBSCALE_LABEL_CHAR_PX;
			const labelFits = estTextPx + SUBSCALE_LABEL_ARC_PAD_PX <= arcLenPx;
			return {
				id: `subscale-tp-${idx}`,
				label,
				labelFits,
				i0: run.i0,
				i1: run.i1,
				t0,
				t1,
				textPathD: labelCircleArcD(cx, cy, dimensionLabelR, t0, t1, labelPathReverse(mid))
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

	/** Context rail highlights one subscale: hide other subscale wedge labels (option B). */
	const subscaleHighlightLocked = $derived(
		highlightSubscaleKey != null && String(highlightSubscaleKey).trim() !== ''
	);

	/**
	 * Pole copy from `statement_encoding.json` (`statement_values`), on arcs at the spike axis
	 * endpoints: `plotOuterR` (domain max) and `scaleInnerR` (domain min). Arc span widens as needed
	 * so long strings are not truncated on the inner ring (may extend past the wedge angle).
	 */
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
		// half-step is TAU/n/2; user-approved window = 0.35× half-step
		const halfStep = TAU / n / 2;
		return Math.max(0.02, Math.min(0.14, 1 * halfStep));
	}

	function statementSpikePointsLocalXY(i, rRefArr, rDataArr) {
		const n = layout.n;
		if (!n) return [];
		const ang = layout.angles[i];
		const half = statementSpikeHalfAngle(n);
		const rr = rRefArr[i] ?? sampleRCyclic(ang, n, rRefArr);
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

	const convergenceByStatement = $derived.by(() => {
		const n = layout.n;
		if (!n || !viz?.modelSeries?.length) return [];
		const models = viz.modelSeries.map((s) => s.fundModel);
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
			if (allAbove) sharedTip = minR;
			else if (allBelow) sharedTip = maxR;
			out.push({ i, rBase, sharedTip, allAbove, allBelow, rByModel });
		}
		return out;
	});

	const isolatedModelSeries = $derived.by(() => {
		if (!selectedModel) return null;
		return viz?.modelSeries?.find((s) => s.fundModel === selectedModel) ?? null;
	});

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

		if (!layout.n || !viz?.modelSeries?.length || !convergenceByStatement.length) {
			return { greyPaths, coloredPaths };
		}

		for (const st of convergenceByStatement) {
			if (st.sharedTip !== null && Math.abs(st.sharedTip - st.rBase) > 1e-6) {
				const sharedPts = sampleStatementSpikeCurveXY(st.i, st.rBase, st.sharedTip);
				const dShared = pathFromXY(sharedPts);
				if (dShared) greyPaths.push({ d: dShared, key: `grey-${st.i}`, statementIndex: st.i });
			}
		}

		if (!selectedModel) {
			for (const st of convergenceByStatement) {
				for (const ms of viz.modelSeries) {
					const r = st.rByModel.get(ms.fundModel) ?? st.rBase;
					if (st.sharedTip !== null) {
						if ((st.allAbove && r > st.sharedTip + 1e-6) || (st.allBelow && r < st.sharedTip - 1e-6)) {
							const outerTip = st.allAbove ? r : st.sharedTip;
							const innerTip = st.allAbove ? st.sharedTip : r;
							const outerPts = sampleStatementSpikeCurveXY(st.i, st.rBase, outerTip);
							const innerPts = sampleStatementSpikeCurveXY(st.i, st.rBase, innerTip);
							const dStrip = stripPathBetweenCurves(outerPts, innerPts);
							if (dStrip) {
								coloredPaths.push({
									d: dStrip,
									fill: modelColor(ms.fundModel),
									key: `${st.i}-${ms.fundModel}-strip`,
									area: Math.abs(outerTip - innerTip),
									statementIndex: st.i
								});
							}
						}
					} else if (Math.abs(r - st.rBase) > 1e-6) {
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
			}
		} else if (isolatedModelSeries && isolatedModelRData.length) {
			const c = modelColor(selectedModel);
			for (const st of convergenceByStatement) {
				const r = isolatedModelRData[st.i] ?? st.rBase;
				if (st.sharedTip !== null) {
					if ((st.allAbove && r > st.sharedTip + 1e-6) || (st.allBelow && r < st.sharedTip - 1e-6)) {
						const outerTip = st.allAbove ? r : st.sharedTip;
						const innerTip = st.allAbove ? st.sharedTip : r;
						const outerPts = sampleStatementSpikeCurveXY(st.i, st.rBase, outerTip);
						const innerPts = sampleStatementSpikeCurveXY(st.i, st.rBase, innerTip);
						const dStrip = stripPathBetweenCurves(outerPts, innerPts);
						if (dStrip) {
							coloredPaths.push({
								d: dStrip,
								fill: c,
								key: `${st.i}-${selectedModel}-iso-strip`,
								area: Math.abs(outerTip - innerTip),
								statementIndex: st.i
							});
						}
					}
				} else if (Math.abs(r - st.rBase) > 1e-6) {
					const pts = sampleStatementSpikeCurveXY(st.i, st.rBase, r);
					const dSpikeFill = pathFromXY(pts);
					if (dSpikeFill) {
						coloredPaths.push({
							d: dSpikeFill,
							fill: c,
							key: `${st.i}-${selectedModel}-iso-full`,
							area: Math.abs(r - st.rBase),
							statementIndex: st.i
						});
					}
				}
			}
		}

		coloredPaths.sort((a, b) => b.area - a.area);
		return { greyPaths, coloredPaths };
	});

	const spikeHoverTargets = $derived.by(() => {
		if (!layout.n || !viz?.modelSeries?.length || !meanPathRefRadii.length) return [];
		/** @type {{ key: string, d: string, model: string, item: object, responseText: string, statementIndex: number }[]} */
		const targets = [];
		const activeSeries =
			selectedModel === null
				? viz.modelSeries
				: viz.modelSeries.filter((series) => series.fundModel === selectedModel);
		for (const model of activeSeries) {
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

	function clampTooltip(rawX, rawY, tw, th) {
		const maxX = Math.max(TOOLTIP_PAD, width - tw - TOOLTIP_PAD);
		const maxY = Math.max(TOOLTIP_PAD, height - th - TOOLTIP_PAD);
		return {
			x: Math.max(TOOLTIP_PAD, Math.min(maxX, rawX)),
			y: Math.max(TOOLTIP_PAD, Math.min(maxY, rawY))
		};
	}

	/**
	 * @param {MouseEvent} event
	 * @param {string} model
	 * @param {object} item
	 * @param {string} responseText
	 */
	function setDotHover(event, model, item, responseText) {
		const rect = event.currentTarget?.ownerSVGElement?.getBoundingClientRect();
		const localX = rect ? event.clientX - rect.left : 0;
		const localY = rect ? event.clientY - rect.top : 0;
		const placeLeft = localX > width / 2;
		// Anchor the nearest tooltip edge near cursor so short tooltips don't sit far away.
		const rightEdgeX = Math.max(TOOLTIP_PAD + TOOLTIP_MAX_W, Math.min(width - TOOLTIP_PAD, localX - 12));
		const leftEdgeX = Math.max(
			TOOLTIP_PAD,
			Math.min(width - TOOLTIP_MAX_W - TOOLTIP_PAD, localX + 12)
		);
		const x = placeLeft ? rightEdgeX : leftEdgeX;
		const y = clampTooltip(localX, localY - 52, TOOLTIP_MAX_W, 120).y;
		tooltip = {
			kind: 'dot',
			x,
			y,
			placeLeft,
			model,
			subscaleLabel: String(item?.subscaleLabel ?? ''),
			statementText: statementLabel(item),
			responseText: responseText || ''
		};
	}

	function clearDotHover() {
		tooltip = null;
	}

	/** @param {string} subscaleKey */
	function handleSubscaleWedgeClick(subscaleKey) {
		onSubscaleWedgeClick(subscaleKey);
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
				{#if focusedSubscalePoleLabels}
					{#if focusedSubscalePoleLabels.twoPoles}
						<path id="radial-pole-outer" d={focusedSubscalePoleLabels.outerPathD} fill="none" />
						<path id="radial-pole-inner" d={focusedSubscalePoleLabels.innerPathD} fill="none" />
					{:else}
						<path id="radial-pole-single" d={focusedSubscalePoleLabels.singlePathD} fill="none" />
					{/if}
				{/if}
			</defs>

			<g clip-path="url(#radial-plot-disc-clip)">
				<!-- Inner hub: same grey as column chrome / wedge separators -->
				<circle
					cx={layout.cx}
					cy={layout.cy}
					r={layout.hubR}
					fill={WEDGE_BORDER_STROKE}
					aria-hidden="true"
				/>

				<!-- Neutral reference circle: midpoint of value scale (spike baseline / ref radius). -->
				<circle
					cx={layout.cx}
					cy={layout.cy}
					r={(layout.scaleInnerR + layout.plotOuterR) / 2}
					fill="none"
					stroke={DIMENSION_RING_FILL}
					stroke-width={SUBSCALE_RIM_WIDTH}
					aria-hidden="true"
					pointer-events="none"
				/>

				{#if layout.n && viz.modelSeries?.length && convergenceFillLayers.coloredPaths.length + convergenceFillLayers.greyPaths.length > 0}
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
								fill-opacity="0.78"
								opacity={opacityForStatementIndex(g.statementIndex)}
							/>
						{/each}
					</g>
				{/if}

				<!-- Hover target overlays for statement spikes -->
				<g transform="translate({layout.cx},{layout.cy})" class="spike-hit-targets">
					{#each spikeHoverTargets as t (t.key)}
						<path
							d={t.d}
							fill="none"
							stroke="transparent"
							stroke-width="13"
							stroke-linecap="round"
							stroke-linejoin="round"
							opacity={opacityForStatementIndex(t.statementIndex)}
							role="presentation"
							aria-hidden="true"
							onmouseenter={(event) => setDotHover(event, t.model, t.item, t.responseText)}
							onmousemove={(event) => setDotHover(event, t.model, t.item, t.responseText)}
							onmouseleave={clearDotHover}
						/>
					{/each}
				</g>

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
									stroke={WEDGE_BORDER_STROKE}
									stroke-width={SUBSCALE_SPOKE_WIDTH}
									stroke-linecap="butt"
								/>
							{/each}
						{/if}
					</g>

					<!-- Outer grey annulus: one sector per subscale (former dimension-ring styling). -->
					<g aria-hidden="true" class="subscale-ring-grid" pointer-events="none">
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
								stroke={DIMENSION_RING_SEPARATOR}
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
								stroke={DIMENSION_RING_SEPARATOR}
								stroke-width={DIMENSION_SPOKE_WIDTH}
								stroke-linecap="butt"
							/>
						{/each}
					</g>

					<g class="subscale-hit-targets">
						{#each layout.subscaleArcs as arc (arc.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
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
								onclick={() => handleSubscaleWedgeClick(viz.dim.items[arc.i0]?.subscaleKey ?? '__none__')}
							/>
						{/each}
					</g>
				{/if}
			</g>

			<!-- Subscale names on the outer grey annulus (Dimension view). -->
			{#if showGroupingMarkers}
				<g aria-hidden="true" class="subscale-labels" pointer-events="none">
					{#each layout.subscaleArcs as arc (arc.id)}
						{#if arc.labelFits && (!subscaleHighlightLocked || normSubscaleKey(viz.dim.items[arc.i0]?.subscaleKey) === normSubscaleKey(highlightSubscaleKey))}
							<text class="subscale-label-text" dominant-baseline="middle">
								<textPath href={`#${arc.id}`} startOffset="50%" text-anchor="middle">
									{arc.label}
								</textPath>
							</text>
						{/if}
					{/each}
				</g>
			{/if}
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
				maxWidth={TOOLTIP_MAX_W}
				placeLeft={tooltip.placeLeft}
				subscaleLabel={tooltip.subscaleLabel}
				statementText={tooltip.statementText}
				model={tooltip.model}
				responseText={tooltip.responseText}
			/>
		{/if}
		<img class="radial-legend" src={RADIAL_LEGEND_SRC} alt="Radial chart legend" />
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
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.subscale-pole-label {
		fill: #475569;
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.radial-legend {
		position: absolute;
		right: 4px;
		bottom: 8px;
		width: 200px;
		height: auto;
		z-index: 4;
		pointer-events: none;
		user-select: none;
	}
</style>
