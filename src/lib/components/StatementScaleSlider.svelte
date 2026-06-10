<script>
	/** @type {{
		id: string,
		label: string,
		min: number,
		max: number,
		minLabel?: string,
		maxLabel?: string,
		value: number,
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
		disabled = false,
		onChange
	} = $props();

	const lo = $derived(Math.min(min, max));
	const hi = $derived(Math.max(min, max));
</script>

<div class="space-y-2 border-b border-white/10 py-6 last:border-b-0 md:py-7">
	<p class="text-sm leading-snug text-white/95">{label}</p>
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
