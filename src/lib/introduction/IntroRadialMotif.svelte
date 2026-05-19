<script>
	/** Decorative radial spike ring (placeholder until design SVG is supplied). */
	const SIZE = 520;
	const CX = SIZE / 2;
	const CY = SIZE / 2;
	const INNER_R = 58;
	const OUTER_BASE = 200;

	const SPIKE_COUNT = 80;

	const spikes = Array.from({ length: SPIKE_COUNT }, (_, i) => {
		const t = i / SPIKE_COUNT;
		const angle = t * Math.PI * 2 - Math.PI / 2;
		const wobble = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(i * 1.73 + 0.4));
		const outerR = INNER_R + OUTER_BASE * wobble;
		const halfWidth = 0.018 + 0.012 * (0.5 + 0.5 * Math.cos(i * 2.1));
		const a0 = angle - halfWidth;
		const a1 = angle + halfWidth;
		const x0 = CX + INNER_R * Math.cos(a0);
		const y0 = CY + INNER_R * Math.sin(a0);
		const x1 = CX + outerR * Math.cos(angle);
		const y1 = CY + outerR * Math.sin(angle);
		const x2 = CX + INNER_R * Math.cos(a1);
		const y2 = CY + INNER_R * Math.sin(a1);
		const fill = i % 3 === 0 ? '#2a3f6e' : i % 3 === 1 ? '#4a4a4a' : '#3d3d3d';
		return { d: `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} Z`, fill };
	});
</script>

<div
	class="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center opacity-90"
	aria-hidden="true"
>
	<svg
		class="h-[min(88vw,520px)] w-[min(88vw,520px)] max-w-none"
		viewBox={`0 0 ${SIZE} ${SIZE}`}
		role="presentation"
	>
		<circle cx={CX} cy={CY} r={OUTER_BASE + INNER_R + 12} fill="none" stroke="#5a5a5a" stroke-width="1" opacity="0.35" />
		<circle cx={CX} cy={CY} r={INNER_R + 6} fill="#3a3a3a" opacity="0.95" />
		{#each spikes as spike, i (i)}
			<path d={spike.d} fill={spike.fill} opacity="0.92" />
		{/each}
	</svg>
</div>
