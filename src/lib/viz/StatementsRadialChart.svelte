<script>
	import * as d3 from 'd3';
	import {
		fillColorForItem,
		scaleTextForValue,
		RADIAL_FILL_PALETTE_COOL,
		RADIAL_FILL_PALETTE_WARM
	} from '$lib/viz/valuePalette.js';
	import { statementLabel } from '$lib/ui/statementLabel.js';

	const PANEL_BG = '#ebebeb';
	const SPOKE_GUIDE = '#d4d4d4';
	const LABEL_RING_STROKE = '#a3a3a3';
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

	/** @type {{ width: number, height: number, viz: Viz, selectedModel: string }} */
	let { width, height, viz, selectedModel } = $props();

	/**
	 * @type { { kind: 'dot', x: number, y: number, model: string, subscaleLabel: string, statementText: string, responseText: string }
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
				innerR: 14,
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
		/** Larger hub (empty center); statement scales still map innerR → plotOuterR. */
		const innerR = Math.max(14, plotOuterR * 0.17);
		const labelTextR = (plotOuterR + fullOuterR) / 2;

		const angles = [];
		const rScales = [];
		for (let i = 0; i < n; i++) {
			angles.push(-Math.PI / 2 + (i / n) * 2 * Math.PI);
			const ext = viz.itemExtents[i] ?? [0, 1];
			rScales.push(d3.scaleLinear().domain(ext).range([innerR, plotOuterR]));
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
			innerR,
			angles,
			rScales,
			n,
			subscaleArcs
		};
	});

	function polar(cx, cy, r, ang) {
		return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
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

	/**
	 * Above/below threshold bands (translate(cx,cy) in markup). Geometry follows mean vs ref, not d3 min() hybrid.
	 */
	const radialBandPaths = $derived.by(() => {
		const empty = { pathAbove: '', pathBelow: '', hasFill: false };
		if (!viz?.dim?.items?.length || !layout.n) return empty;
		const n = layout.n;
		const selected = viz.modelSeries.find((s) => s.fundModel === selectedModel);

		const rRef = [];
		for (let i = 0; i < n; i++) {
			rRef.push(refRadiusAtIndex(i));
		}

		let pathAbove = '';
		let pathBelow = '';
		if (selected && layout.subscaleArcs.length) {
			const rDataEff = [];
			for (let i = 0; i < n; i++) {
				rDataEff.push(effectiveRForModelAt(selected, i));
			}
			const bands = deviationBandPathsPerSubscaleD(n, rRef, rDataEff, layout.subscaleArcs);
			pathBelow = bands.pathBelow;
			pathAbove = bands.pathAbove;
		}

		return { pathAbove, pathBelow, hasFill: Boolean(selected) };
	});

	const radialClipBase = $derived(
		`${String(selectedModel).replace(/[^a-zA-Z0-9_-]/g, '_')}-${layout.n}`
	);
	const radialSpectrumClipBelowId = $derived(`radial-spectrum-below-${radialClipBase}`);
	const radialSpectrumClipAboveId = $derived(`radial-spectrum-above-${radialClipBase}`);

	/**
	 * Annulus path (origin = chart center via parent translate). evenodd subtracts inner disc.
	 */
	function annulusPathD(rInner, rOuter) {
		if (!(rOuter > rInner) || rInner < 0) return '';
		return [
			`M 0 ${-rOuter}`,
			`a ${rOuter} ${rOuter} 0 1 1 0 ${2 * rOuter}`,
			`a ${rOuter} ${rOuter} 0 1 1 0 ${-2 * rOuter}`,
			`M 0 ${-rInner}`,
			`a ${rInner} ${rInner} 0 1 0 0 ${2 * rInner}`,
			`a ${rInner} ${rInner} 0 1 0 0 ${-2 * rInner}`
		].join(' ');
	}

	/**
	 * Five equal annuli from innerR → plotOuterR, one palette stop each (no stacked-disk bleed).
	 * Cool slice is ordered dark → light in the array; warm is light → dark. Darkest at plot outer for both.
	 * @param {string[]} pal
	 * @param {boolean} coolSlice — if true, reverse index so outer = pal[0] (darkest blue)
	 */
	function discreteSpectrumAnnuli(pal, coolSlice) {
		const inner = layout.innerR;
		const outer = layout.plotOuterR;
		const span = Math.max(1e-6, outer - inner);
		const n = pal.length;
		/** @type {{ k: number, d: string, fill: string }[]} */
		const rings = [];
		for (let i = 0; i < n; i++) {
			const r0 = inner + (i / n) * span;
			const r1 = inner + ((i + 1) / n) * span;
			const idx = coolSlice ? i : i;
			rings.push({
				k: i,
				d: annulusPathD(r0, r1),
				fill: pal[idx] ?? '#94a3b8'
			});
		}
		return rings;
	}

	const concentricCoolRings = $derived.by(() =>
		discreteSpectrumAnnuli(RADIAL_FILL_PALETTE_COOL, true)
	);
	const concentricWarmRings = $derived.by(() =>
		discreteSpectrumAnnuli(RADIAL_FILL_PALETTE_WARM, false)
	);

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
		const pos = clampTooltip(localX + 12, localY - 52, TOOLTIP_MAX_W, 120);
		tooltip = {
			kind: 'dot',
			x: pos.x,
			y: pos.y,
			model,
			subscaleLabel: String(item?.subscaleLabel ?? ''),
			statementText: statementLabel(item),
			responseText: responseText || ''
		};
	}

	function clearDotHover() {
		tooltip = null;
	}
</script>

{#if !viz || !layout.n}
	<p class="text-sm text-slate-500">No data.</p>
{:else}
	<div class="chart-wrap max-h-full max-w-full" style="width: {width}px; height: {height}px;">
		<svg
			width={width}
			height={height}
			class="block max-h-full max-w-full"
			style="overflow: visible"
			role="img"
			aria-label="Radial chart of model mean responses by statement. Hover dots for details."
			focusable="false"
		>
			<rect x="0" y="0" width={width} height={height} fill={PANEL_BG} />

			<!-- Plot annulus: stroke-only subscale separation (no fill), no per-statement spokes -->
			<g aria-hidden="true" class="subscale-plot-grid" pointer-events="none">
				<circle
					cx={layout.cx}
					cy={layout.cy}
					r={layout.innerR}
					fill="none"
					stroke={SPOKE_GUIDE}
					stroke-width="1"
				/>
				<circle
					cx={layout.cx}
					cy={layout.cy}
					r={layout.plotOuterR}
					fill="none"
					stroke={SPOKE_GUIDE}
					stroke-width="1"
				/>
				{#if layout.subscaleArcs.length > 1}
					{#each layout.subscaleArcs as arc (arc.id)}
						{@const x0 = layout.cx + layout.innerR * Math.cos(arc.t0)}
						{@const y0 = layout.cy + layout.innerR * Math.sin(arc.t0)}
						{@const x1 = layout.cx + layout.plotOuterR * Math.cos(arc.t0)}
						{@const y1 = layout.cy + layout.plotOuterR * Math.sin(arc.t0)}
						<line x1={x0} y1={y0} x2={x1} y2={y1} stroke={SPOKE_GUIDE} stroke-width="1" />
					{/each}
				{/if}
			</g>

			<defs>
				{#each layout.subscaleArcs as arc (arc.id)}
					<path id={arc.id} d={arc.textPathD} fill="none" />
				{/each}
			</defs>

			<!-- Subscale ring: cell borders -->
			<g aria-hidden="true" class="subscale-ring" pointer-events="none">
				{#each layout.subscaleArcs as arc, sidx (sidx)}
					{@const xA = layout.cx + layout.plotOuterR * Math.cos(arc.t0)}
					{@const yA = layout.cy + layout.plotOuterR * Math.sin(arc.t0)}
					{@const xOuterA = layout.cx + layout.fullOuterR * Math.cos(arc.t0)}
					{@const yOuterA = layout.cy + layout.fullOuterR * Math.sin(arc.t0)}
					{@const xOuterB = layout.cx + layout.fullOuterR * Math.cos(arc.t1)}
					{@const yOuterB = layout.cy + layout.fullOuterR * Math.sin(arc.t1)}
					<path
						d={geometricSectorArcD(
							layout.cx,
							layout.cy,
							layout.plotOuterR,
							arc.t0,
							arc.t1
						)}
						fill="none"
						stroke={LABEL_RING_STROKE}
						stroke-width="1"
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
						stroke={LABEL_RING_STROKE}
						stroke-width="1"
					/>
					<line
						x1={xA}
						y1={yA}
						x2={xOuterA}
						y2={yOuterA}
						stroke={LABEL_RING_STROKE}
						stroke-width="1"
					/>
					<line
						x1={layout.cx + layout.plotOuterR * Math.cos(arc.t1)}
						y1={layout.cy + layout.plotOuterR * Math.sin(arc.t1)}
						x2={xOuterB}
						y2={yOuterB}
						stroke={LABEL_RING_STROKE}
						stroke-width="1"
					/>
				{/each}
			</g>

			<g aria-hidden="true" class="subscale-labels" pointer-events="none">
				{#each layout.subscaleArcs as arc (arc.id)}
					<text class="subscale-label-text" dominant-baseline="middle">
						<textPath href={`#${arc.id}`} startOffset="50%" text-anchor="middle">
							{arc.label}
						</textPath>
					</text>
				{/each}
			</g>

			{#if radialBandPaths.hasFill}
				<!-- Trapezoid clips are disjoint (mean vs ref); no warm mask — masking pathBelow hid large warm regions in some cases. -->
				<g
					transform="translate({layout.cx},{layout.cy})"
					class="radial-threshold-bands"
					aria-hidden="true"
					pointer-events="none"
				>
					<defs>
						<clipPath id={radialSpectrumClipBelowId}>
							{#if radialBandPaths.pathBelow}
								<path d={radialBandPaths.pathBelow} />
							{/if}
						</clipPath>
						<clipPath id={radialSpectrumClipAboveId}>
							{#if radialBandPaths.pathAbove}
								<path d={radialBandPaths.pathAbove} />
							{/if}
						</clipPath>
					</defs>
					<g clip-path="url(#{radialSpectrumClipBelowId})" fill-opacity="0.58">
						{#each concentricCoolRings as ring (ring.k)}
							<path d={ring.d} fill={ring.fill} fill-rule="evenodd" />
						{/each}
					</g>
					<g clip-path="url(#{radialSpectrumClipAboveId})" fill-opacity="0.58">
						{#each concentricWarmRings as ring (ring.k)}
							<path d={ring.d} fill={ring.fill} fill-rule="evenodd" />
						{/each}
					</g>
				</g>
			{/if}

			{#if layout.n && layout.subscaleArcs.length && viz.modelSeries?.length}
				<g
					transform="translate({layout.cx},{layout.cy})"
					class="subscale-mean-paths"
					pointer-events="none"
					aria-hidden="true"
				>
					{#each [...viz.modelSeries].sort((a, b) => {
						if (a.fundModel === selectedModel) return 1;
						if (b.fundModel === selectedModel) return -1;
						return 0;
					}) as m (m.fundModel)}
						{#each layout.subscaleArcs as arc (`${m.fundModel}-${arc.id}`)}
							{@const dSub = subscaleMeanPolylinePathLocalD(m, arc, meanPathRefRadii)}
							{@const isSelected = m.fundModel === selectedModel}
							{#if dSub}
								<path
									fill="none"
									stroke={isSelected ? SELECTED_PATH_STROKE : INACTIVE_MODEL_PATH_STROKE}
									stroke-width={isSelected ? 1.35 : 1}
									d={dSub}
								/>
							{/if}
						{/each}
					{/each}
				</g>
			{/if}

			{#each viz.modelSeries as m (m.fundModel)}
				{#if m.fundModel === selectedModel}
					{#each m.itemMeans as value, itemIndex (itemIndex)}
						{#if value !== null && value !== undefined && !Number.isNaN(value)}
							{@const item = viz.dim.items[itemIndex]}
							{@const ang = layout.angles[itemIndex]}
							{@const r = layout.rScales[itemIndex](value)}
							{@const pt = polar(layout.cx, layout.cy, r, ang)}
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
								cx={pt[0]}
								cy={pt[1]}
								r={3}
								fill={fillColorForItem(item, value)}
								stroke="#1c1917"
								stroke-width={0.45}
								onmouseenter={(e) => setDotHover(e, m.fundModel, item, responseText)}
								onmousemove={(e) => setDotHover(e, m.fundModel, item, responseText)}
								onmouseleave={clearDotHover}
							/>
						{/if}
					{/each}
				{/if}
			{/each}
		</svg>

		{#if tooltip?.kind === 'dot'}
			<div
				class="tooltip"
				style="left: {tooltip.x}px; top: {tooltip.y}px; max-width: {TOOLTIP_MAX_W}px;"
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
