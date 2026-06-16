<script>
	/** @type {{
		id: string,
		label: string,
		min: number,
		max: number,
		minLabel?: string,
		maxLabel?: string,
		value: number,
		weightPct?: number | null,
		disabled?: boolean,
		onChange?: (value: number) => void
	}} */
	let {
		id,
		label,
		min,
		max,
		minLabel = '',
		maxLabel = '',
		value,
		weightPct = null,
		disabled = false,
		onChange
	} = $props();

	const lo = $derived(Math.min(min, max));
	const hi = $derived(Math.max(min, max));

	function formatWeightPct(pct) {
		if (!Number.isFinite(pct) || pct <= 0) return '0%';
		if (pct < 0.1) return '<0.1%';
		if (pct >= 10) return `${Math.round(pct)}%`;
		return `${pct.toFixed(1)}%`;
	}
</script>

<div class="space-y-2 border-b border-white/10 py-6 last:border-b-0 md:py-7">
	<div class="flex items-start justify-between gap-3">
		<p class="min-w-0 flex-1 text-sm leading-snug text-white/95">{label}</p>
		{#if weightPct != null}
			<span
				class="shrink-0 pt-0.5 text-[10px] font-semibold tabular-nums tracking-wide text-white/45"
				title="Share of total weight in ideology similarity (higher when models disagree more)"
			>
				{formatWeightPct(weightPct)}
			</span>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		<span class="w-[4.5rem] shrink-0 text-[10px] leading-tight text-white/60">{minLabel || lo}</span>
		<input
			{id}
			type="range"
			class="statement-slider min-w-0 flex-1"
			min={lo}
			max={hi}
			step="1"
			{value}
			{disabled}
			oninput={(e) => {
				const v = Number(e.currentTarget.value);
				if (Number.isFinite(v)) onChange?.(v);
			}}
		/>
		<span class="w-[4.5rem] shrink-0 text-right text-[10px] leading-tight text-white/60"
			>{maxLabel || hi}</span
		>
	</div>
</div>

<style>
	.statement-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.35);
		outline: none;
	}

	.statement-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		border: none;
	}

	.statement-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		border: none;
	}

	.statement-slider:disabled {
		opacity: 0.55;
	}
</style>
