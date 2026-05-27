<script>
	import { modelColor } from '$lib/viz/modelColors.js';

	/** @type {{
		visibleModels?: string[],
		selectedModels?: string[],
		selectedDebateId?: string | null,
		allModelsShowing?: boolean,
		compact?: boolean,
		compareLabel?: string,
		onModelToggle?: (model: string) => void,
		onCompare?: () => void
	}} */
	let {
		visibleModels = [],
		selectedModels = [],
		selectedDebateId = null,
		allModelsShowing = true,
		compact = false,
		compareLabel = 'COMPARE ADVICE',
		onModelToggle,
		onCompare
	} = $props();

	const compareEnabled = $derived(
		Boolean(String(selectedDebateId ?? '').trim()) && selectedModels.length === 2
	);
</script>

<div
	class="shrink-0 bg-[#4B4B4E] px-4 pb-4 text-white {compact
		? 'border-b border-slate-600 pt-2'
		: 'border-t border-slate-500 pt-4 md:pt-5'}"
>
	<div class="model-row mt-0 flex w-full flex-nowrap md:mt-0">
		{#each visibleModels as model (model)}
			{@const active = allModelsShowing || selectedModels.includes(model)}
			<button
				type="button"
				class="model-btn min-w-0 flex-1 cursor-pointer rounded-full text-xs font-semibold text-white transition-opacity md:text-xs {active
					? 'opacity-100'
					: 'bg-[#7a7a7a] opacity-55 hover:opacity-75'}"
				style={active ? `background-color: ${modelColor(model)};` : ''}
				onclick={() => onModelToggle?.(model)}
			>
				{model}
			</button>
		{/each}
	</div>
	<div class="mt-5 flex items-center justify-center md:mt-6">
		<button
			type="button"
			class={`compare-btn h-9 w-full max-w-none rounded-full px-5 text-xs font-bold uppercase tracking-wide md:h-10 md:text-sm ${
				compareEnabled
					? 'cursor-pointer bg-white text-slate-900'
					: 'cursor-not-allowed bg-[#3B3A3A] text-white/70'
			}`}
			aria-disabled={!compareEnabled}
			onclick={() => {
				if (!compareEnabled) return;
				onCompare?.();
			}}
		>
			<span>{compareLabel}</span>
		</button>
	</div>
</div>

<style>
	.model-row {
		gap: 2px;
		margin-left: 0;
		margin-right: 0;
		width: 100%;
	}

	.model-btn {
		flex: 1 1 0;
		min-width: 0;
		box-sizing: border-box;
		padding: 4px 1px;
		font-size: 0.625rem;
		line-height: 1.1;
		letter-spacing: -0.02em;
		text-align: center;
		white-space: nowrap;
	}

	.compare-btn {
		font-size: 0.75rem;
		line-height: 1.15;
	}

	@media (min-width: 768px) {
		.model-row {
			gap: 0.5rem;
			margin-left: 0;
			margin-right: 0;
			width: 100%;
		}

		.model-btn {
			padding: 6px 8px;
			font-size: 0.75rem;
			line-height: 1rem;
			letter-spacing: 0;
		}

		.compare-btn {
			font-size: 0.875rem;
			line-height: 1.25rem;
		}
	}
</style>
