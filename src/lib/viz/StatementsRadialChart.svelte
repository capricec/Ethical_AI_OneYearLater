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
	const NON_SELECTED_PATH_STROKE = '#9ca3af';
	const SELECTED_PATH_STROKE = '#0a0a0a';

	/** Stacked filled circles (Baby Spike style) — discrete steps along the value palette, then clip to the area. */
	const CONCENTRIC_BANDS = 56;

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

	/** @type {string | null} */
	let hoveredModel = $state(null);
	/** @type {{ kind: 'dot', x: number, y: number, model: string, responseText: string } | { kind: 'spoke', x: number, y: number, dimensionTitle: string, subscaleLabel: string, statementText: string } | null} */
	let tooltip = $state(null);

	/** Inset from SVG edge to plot (spokes use full usable side = min(w,h) − 2×PAD). */
	const PAD = 8;
	const TOOLTIP_PAD = 8;
	const TOOLTIP_MAX_W = 280;
	const SPOKE_TOOLTIP_W = 340;
	const SPOKE_TOOLTIP_H = 140;

	const activeModel = $derived(hoveredModel ?? selectedModel);

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
				innerR: 8,
				angles: /** @type {number[]} */ ([]),
				rScales: /** @type {import('d3').ScaleLinear<number, number>[]} */ ([]),
				n: 0,
				subscaleArcs: /** @type {{ id: string, label: string, t0: number, t1: number, textPathD: string }[]} */ (
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
		const innerR = Math.max(10, plotOuterR * 0.08);
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

	/** Dense angular samples: must match deviation quads so the stroke sits on the same piecewise-linear mean as the fill. */
	function denseSegCount(n) {
		return Math.max(96, n * 16);
	}

	const meanRingLineLinear = d3
		.lineRadial()
		.curve(d3.curveLinearClosed)
		.angle((d) => d.angle)
		.radius((d) => d.r);

	const TAU = 2 * Math.PI;

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
	 * Deviation clips: below = strip mean→ref only where rData<rRef; above = ref→mean only where rData>rRef.
	 * Inner/outer edges always use interpolated rData and rRef (never min hybrid), so fills cannot cross the black mean.
	 */
	function deviationBandPathsD(n, rRef, rData) {
		const N_SEG = denseSegCount(n);
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

		/** rD < rR: clamped crossing fixes gaps when f=0 at an endpoint (old strict 0<t<1 dropped whole segments). */
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

		for (let j = 0; j < N_SEG; j++) {
			const ta = -Math.PI / 2 + (j / N_SEG) * TAU;
			const tb = -Math.PI / 2 + ((j + 1) / N_SEG) * TAU;
			const rDa = sampleRCyclic(ta, n, rData);
			const rRa = sampleRCyclic(ta, n, rRef);
			const rDb = sampleRCyclic(tb, n, rData);
			const rRb = sampleRCyclic(tb, n, rRef);

			addBelowSegment(ta, tb, rDa, rDb, rRa, rRb);
			addAboveSegment(ta, tb, rDa, rDb, rRa, rRb);
		}

		return {
			pathBelow: belowParts.join(' '),
			pathAbove: aboveParts.join(' ')
		};
	}

	/**
	 * Closed mean loop — same dense linear r(θ) as deviation inner/outer data edges (local coords).
	 * @param {{ fundModel: string, itemMeans: (number|null)[] }} m
	 */
	function modelMeanRingPathLocalD(m) {
		const n = layout.n;
		if (n < 3) return '';
		const rDataEff = [];
		for (let i = 0; i < n; i++) {
			rDataEff.push(effectiveRForModelAt(m, i));
		}
		const N = denseSegCount(n);
		const pts = [];
		for (let k = 0; k < N; k++) {
			const theta = -Math.PI / 2 + (k / N) * TAU;
			pts.push({
				angle: theta + Math.PI / 2,
				r: sampleRCyclic(theta, n, rDataEff)
			});
		}
		return meanRingLineLinear(pts) ?? '';
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
		if (selected) {
			const rDataEff = [];
			for (let i = 0; i < n; i++) {
				rDataEff.push(effectiveRForModelAt(selected, i));
			}
			const bands = deviationBandPathsD(n, rRef, rDataEff);
			pathBelow = bands.pathBelow;
			pathAbove = bands.pathAbove;
		}

		return { pathAbove, pathBelow, hasFill: Boolean(selected) };
	});

	/** t ∈ [0,1] along radius; `pal` is a sub-slice (cool-only or warm-only) so fills don’t share neutral/peach. */
	function spectrumFillAtT(t, pal) {
		if (!pal.length) return '#94a3b8';
		if (pal.length === 1) return pal[0];
		const n = pal.length - 1;
		const u = Math.max(0, Math.min(1, t)) * n;
		const i0 = Math.min(n, Math.max(0, Math.floor(u)));
		const i1 = Math.min(n, i0 + 1);
		return d3.interpolateRgb(pal[i0], pal[i1])(u - i0);
	}

	const radialClipBase = $derived(
		`${String(selectedModel).replace(/[^a-zA-Z0-9_-]/g, '_')}-${layout.n}`
	);
	const radialSpectrumClipBelowId = $derived(`radial-spectrum-below-${radialClipBase}`);
	const radialSpectrumClipAboveId = $derived(`radial-spectrum-above-${radialClipBase}`);

	function concentricRingsForPalette(pal) {
		const inner = layout.innerR;
		const outer = layout.plotOuterR;
		const span = Math.max(1e-6, outer - inner);
		/** @type {{ k: number, r: number, fill: string }[]} */
		const rings = [];
		for (let step = CONCENTRIC_BANDS; step >= 1; step--) {
			const frac = step / CONCENTRIC_BANDS;
			rings.push({
				k: step,
				r: inner + span * frac,
				fill: spectrumFillAtT(frac, pal)
			});
		}
		return rings;
	}

	const concentricCoolRings = $derived.by(() => concentricRingsForPalette(RADIAL_FILL_PALETTE_COOL));
	const concentricWarmRings = $derived.by(() => concentricRingsForPalette(RADIAL_FILL_PALETTE_WARM));

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
	 * @param {string} responseText
	 */
	function setDotHover(event, model, responseText) {
		hoveredModel = model;
		const rect = event.currentTarget?.ownerSVGElement?.getBoundingClientRect();
		const localX = rect ? event.clientX - rect.left : 0;
		const localY = rect ? event.clientY - rect.top : 0;
		const pos = clampTooltip(localX + 12, localY - 52, 170, 56);
		tooltip = { kind: 'dot', x: pos.x, y: pos.y, model, responseText: responseText || '' };
	}

	/**
	 * @param {MouseEvent} event
	 * @param {object} item
	 */
	function setSpokeHover(event, item) {
		hoveredModel = null;
		const rect = event.currentTarget?.ownerSVGElement?.getBoundingClientRect();
		const localX = rect ? event.clientX - rect.left : 0;
		const localY = rect ? event.clientY - rect.top : 0;
		const pos = clampTooltip(localX + 12, localY - 8, SPOKE_TOOLTIP_W, SPOKE_TOOLTIP_H);
		tooltip = {
			kind: 'spoke',
			x: pos.x,
			y: pos.y,
			dimensionTitle: String(item.dimensionTitle ?? ''),
			subscaleLabel: String(item.subscaleLabel ?? ''),
			statementText: statementLabel(item)
		};
	}

	function clearDotHover() {
		hoveredModel = null;
		tooltip = null;
	}

	function clearSpokeHover() {
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
			aria-label="Radial chart of model mean responses by statement. Hover spokes or dots for details."
			focusable="false"
		>
			<rect x="0" y="0" width={width} height={height} fill={PANEL_BG} />

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
							<circle cx="0" cy="0" r={ring.r} fill={ring.fill} />
						{/each}
					</g>
					<g clip-path="url(#{radialSpectrumClipAboveId})" fill-opacity="0.58">
						{#each concentricWarmRings as ring (ring.k)}
							<circle cx="0" cy="0" r={ring.r} fill={ring.fill} />
						{/each}
					</g>
				</g>
			{/if}

			{#each layout.angles as ang, i (i)}
				{@const x1 = layout.cx + layout.innerR * Math.cos(ang)}
				{@const y1 = layout.cy + layout.innerR * Math.sin(ang)}
				{@const x2 = layout.cx + layout.plotOuterR * Math.cos(ang)}
				{@const y2 = layout.cy + layout.plotOuterR * Math.sin(ang)}
				{@const xHit = layout.cx + layout.fullOuterR * Math.cos(ang)}
				{@const yHit = layout.cy + layout.fullOuterR * Math.sin(ang)}
				<line
					x1={x1}
					y1={y1}
					x2={x2}
					y2={y2}
					stroke={SPOKE_GUIDE}
					stroke-width="1"
					pointer-events="none"
				/>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<line
					x1={x1}
					y1={y1}
					x2={xHit}
					y2={yHit}
					stroke="transparent"
					stroke-width="36"
					pointer-events="stroke"
					onmouseenter={(e) => setSpokeHover(e, viz.dim.items[i])}
					onmousemove={(e) => setSpokeHover(e, viz.dim.items[i])}
					onmouseleave={clearSpokeHover}
				/>
			{/each}

			{#each [...viz.modelSeries].sort((a, b) => {
				if (a.fundModel === activeModel) return 1;
				if (b.fundModel === activeModel) return -1;
				return 0;
			}) as m (m.fundModel)}
				{@const selected = m.fundModel === activeModel}
				{@const dLocal = modelMeanRingPathLocalD(m)}
				{#if dLocal}
					<g transform="translate({layout.cx},{layout.cy})" pointer-events="none">
						<path
							fill="none"
							stroke={selected ? SELECTED_PATH_STROKE : NON_SELECTED_PATH_STROKE}
							stroke-width={selected ? 1.35 : 1.15}
							opacity={selected ? 1 : 0.38}
							d={dLocal}
						/>
					</g>
				{/if}
				{@const rDot = selected ? 3 : 3}
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
							r={rDot}
							fill={fillColorForItem(item, value)}
							stroke={selected ? '#1c1917' : 'transparent'}
							stroke-width={selected ? 0.45 : 0}
							onmouseenter={(e) => setDotHover(e, m.fundModel, responseText)}
							onmousemove={(e) => setDotHover(e, m.fundModel, responseText)}
							onmouseleave={clearDotHover}
						/>
					{/if}
				{/each}
			{/each}
		</svg>

		{#if tooltip?.kind === 'dot'}
			<div
				class="tooltip"
				style="left: {tooltip.x}px; top: {tooltip.y}px; max-width: {TOOLTIP_MAX_W}px;"
				aria-hidden="true"
			>
				<div class="tooltip-model">{tooltip.model}</div>
				{#if tooltip.responseText}
					<div class="tooltip-value">Average Response: {tooltip.responseText}</div>
				{/if}
			</div>
		{:else if tooltip?.kind === 'spoke'}
			<div
				class="tooltip tooltip-spoke"
				style="left: {tooltip.x}px; top: {tooltip.y}px; max-width: {SPOKE_TOOLTIP_W}px;"
				aria-hidden="true"
			>
				{#if tooltip.dimensionTitle}
					<div class="tooltip-dim">{tooltip.dimensionTitle}</div>
				{/if}
				{#if tooltip.subscaleLabel}
					<div class="tooltip-subscale">{tooltip.subscaleLabel}</div>
				{/if}
				<div class="tooltip-statement">{tooltip.statementText}</div>
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

	.tooltip-model {
		font-weight: 600;
	}

	.tooltip-dim {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #64748b;
		margin-bottom: 4px;
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
	}

	.subscale-label-text {
		fill: #1e293b;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
</style>
