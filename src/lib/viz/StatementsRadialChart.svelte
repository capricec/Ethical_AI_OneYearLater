<script>
	import * as d3 from 'd3';
	import { modelColor } from '$lib/viz/modelColors.js';
	import { statementLabel } from '$lib/ui/statementLabel.js';
	import { scaleTextForValue } from '$lib/viz/valuePalette.js';

	const PANEL_BG = '#ffffff';
	/** Pixels beyond outer label ring; keeps curved labels inside the clip. */
	const DISC_CLIP_OUTSET = 4;
	/** White ring between grey hub and inner end of value scale (spike bases). */
	const INNER_SCALE_WHITE_PAD = 14;
	/** Subscale wedge rims + wide radial separators (matches surrounding grey panels). */
	const WEDGE_BORDER_STROKE = '#ebebeb';
	const SUBSCALE_SPOKE_WIDTH = 1;
	const SUBSCALE_RIM_WIDTH = 1;
	const SELECTED_PATH_STROKE = '#0a0a0a';
	const INACTIVE_MODEL_PATH_STROKE = '#a8a29e';

	/** Outer annulus for subscale labels (plot uses radius inside this band). */
	const LABEL_BAND = 30;

	/**
	 * @typedef {object} Viz
	 * @property {{ items: object[] }} dim
	 * @property {{ fundModel: string, itemMeans: (number|null)[] }[]} modelSeries
	 * @property {[number, number][]} itemExtents
	 * @property {{ aggregate: object, item: object }} labels
	 */

	/** @type {{ width: number, height: number, viz: Viz, selectedModel: (string|null), onSubscaleWedgeClick?: ((subscaleKey: string) => void) }} */
	let { width, height, viz, selectedModel, onSubscaleWedgeClick = () => {} } = $props();

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
				plotOuterR: 32,
				labelTextR: 36,
				hubR: 14,
				scaleInnerR: 28,
				clipEdgeR: 40 + DISC_CLIP_OUTSET,
				angles: /** @type {number[]} */ ([]),
				rScales: /** @type {import('d3').ScaleLinear<number, number>[]} */ ([]),
				n: 0,
				subscaleArcs: /** @type {{ id: string, label: string, i0: number, i1: number, t0: number, t1: number, textPathD: string }[]} */ (
					[]
				)
			};
		}
		const n = viz.dim.items.length;
		const cx = width / 2;
		const cy = height / 2;
		const side = Math.max(120, Math.min(width, height) - 2 * PAD);
		const fullOuterR = side / 2;
		const plotOuterR = Math.min(
			Math.max(20, fullOuterR - LABEL_BAND),
			fullOuterR - 4
		);
		/** Grey hub; value scale and spikes start at scaleInnerR (white pad between). */
		const hubR = Math.max(14, plotOuterR * 0.17);
		const scaleInnerR = Math.max(
			hubR + 2,
			Math.min(hubR + INNER_SCALE_WHITE_PAD, plotOuterR - 6)
		);
		const labelTextR = (plotOuterR + fullOuterR) / 2;

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
			return {
				id: `subscale-tp-${idx}`,
				label: run.label,
				i0: run.i0,
				i1: run.i1,
				t0,
				t1,
				textPathD: labelCircleArcD(cx, cy, labelTextR, t0, t1, labelPathReverse(mid))
			};
		});

		return {
			cx,
			cy,
			fullOuterR,
			plotOuterR,
			labelTextR,
			hubR,
			scaleInnerR,
			clipEdgeR: fullOuterR + DISC_CLIP_OUTSET,
			angles,
			rScales,
			n,
			subscaleArcs
		};
	});

	function polar(cx, cy, r, ang) {
		return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
	}

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
		/** @type {{ d: string, key: string }[]} */
		const greyPaths = [];
		/** @type {{ d: string, fill: string, key: string, area: number }[]} */
		const coloredPaths = [];

		if (!layout.n || !viz?.modelSeries?.length || !convergenceByStatement.length) {
			return { greyPaths, coloredPaths };
		}

		for (const st of convergenceByStatement) {
			if (st.sharedTip !== null && Math.abs(st.sharedTip - st.rBase) > 1e-6) {
				const sharedPts = sampleStatementSpikeCurveXY(st.i, st.rBase, st.sharedTip);
				const dShared = pathFromXY(sharedPts);
				if (dShared) greyPaths.push({ d: dShared, key: `grey-${st.i}` });
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
									area: Math.abs(outerTip - innerTip)
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
								area: Math.abs(r - st.rBase)
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
								area: Math.abs(outerTip - innerTip)
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
							area: Math.abs(r - st.rBase)
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
		/** @type {{ key: string, d: string, model: string, item: object, responseText: string }[]} */
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
					responseText
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
	<div
		class="chart-wrap max-h-full max-w-full overflow-visible rounded-full"
		style="width: {width}px; height: {height}px;"
	>
		<svg
			width={width}
			height={height}
			class="block max-h-full max-w-full"
			style="overflow: hidden"
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
			</defs>

			<g clip-path="url(#radial-plot-disc-clip)">
				<rect x="0" y="0" width={width} height={height} fill={PANEL_BG} />

				<!-- Inner hub: same grey as column chrome / wedge separators -->
				<circle
					cx={layout.cx}
					cy={layout.cy}
					r={layout.hubR}
					fill={WEDGE_BORDER_STROKE}
					aria-hidden="true"
				/>

				{#if layout.n && viz.modelSeries?.length && convergenceFillLayers.coloredPaths.length + convergenceFillLayers.greyPaths.length > 0}
					<g
						transform="translate({layout.cx},{layout.cy})"
						class="model-convergence-fills"
						aria-hidden="true"
						pointer-events="none"
					>
						{#each convergenceFillLayers.coloredPaths as p (p.key)}
							<path d={p.d} fill={p.fill} />
						{/each}
						{#each convergenceFillLayers.greyPaths as g (g.key)}
							<path d={g.d} fill="#cecece" fill-opacity="0.78" />
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
							role="presentation"
							aria-hidden="true"
							onmouseenter={(event) => setDotHover(event, t.model, t.item, t.responseText)}
							onmousemove={(event) => setDotHover(event, t.model, t.item, t.responseText)}
							onmouseleave={clearDotHover}
						/>
					{/each}
				</g>

				<!-- Subscale wedges only: rim arcs + wide radials at subscale boundaries to clip edge -->
				<g aria-hidden="true" class="subscale-plot-grid" pointer-events="none">
					{#if layout.subscaleArcs.length <= 1}
						<circle
							cx={layout.cx}
							cy={layout.cy}
							r={layout.clipEdgeR}
							fill="none"
							stroke={WEDGE_BORDER_STROKE}
							stroke-width={SUBSCALE_RIM_WIDTH}
						/>
					{:else}
						{#each layout.subscaleArcs as arc (arc.id)}
							<path
								d={geometricSectorArcD(
									layout.cx,
									layout.cy,
									layout.clipEdgeR,
									arc.t0,
									arc.t1
								)}
								fill="none"
								stroke={WEDGE_BORDER_STROKE}
								stroke-width={SUBSCALE_RIM_WIDTH}
							/>
						{/each}
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

				<g class="subscale-hit-targets">
					{#each layout.subscaleArcs as arc (arc.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<path
							d={annularSectorPathD(
								layout.cx,
								layout.cy,
								Math.max(layout.plotOuterR + 2, layout.hubR),
								layout.clipEdgeR,
								arc.t0,
								arc.t1
							)}
							fill="transparent"
							onclick={() => handleSubscaleWedgeClick(viz.dim.items[arc.i0]?.subscaleKey ?? '__none__')}
						/>
					{/each}
				</g>
			</g>

			<!-- Subscale labels intentionally rendered outside the clipped group so long curved tags
			     (e.g., Environment/Immigration) are never cut off at the outer radius. -->
			<g aria-hidden="true" class="subscale-labels" pointer-events="none">
				{#each layout.subscaleArcs as arc (arc.id)}
					<text class="subscale-label-text" dominant-baseline="middle">
						<textPath href={`#${arc.id}`} startOffset="50%" text-anchor="middle">
							{arc.label}
						</textPath>
					</text>
				{/each}
			</g>
		</svg>

		{#if tooltip?.kind === 'dot'}
			<div
				class="tooltip"
				style="left: {tooltip.x}px; top: {tooltip.y}px; max-width: {TOOLTIP_MAX_W}px; transform: {tooltip.placeLeft
					? 'translateX(-100%)'
					: 'none'};"
				aria-hidden="true"
			>
				{#if tooltip.subscaleLabel}
					<div class="tooltip-subscale">{tooltip.subscaleLabel}</div>
				{/if}
				{#if tooltip.statementText}
					<div class="tooltip-statement">{tooltip.statementText}</div>
				{/if}
				<div class="tooltip-model">{tooltip.model}</div>
				{#if tooltip.responseText}
					<div class="tooltip-value">Average response: {tooltip.responseText}</div>
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
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid #d6d3d1;
		background: rgba(255, 255, 255, 0.96);
		color: #1c1917;
		font-size: 11px;
		line-height: 1.35;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
		z-index: 50;
	}

	.tooltip-subscale {
		font-size: 10px;
		font-weight: 600;
		color: #475569;
		margin-bottom: 6px;
	}

	.tooltip-statement {
		color: #1c1917;
		white-space: normal;
		margin-bottom: 8px;
	}

	.tooltip-model {
		font-weight: 600;
		margin-bottom: 4px;
	}

	.tooltip-value {
		color: #334155;
	}

	.subscale-label-text {
		fill: #1e293b;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
</style>
