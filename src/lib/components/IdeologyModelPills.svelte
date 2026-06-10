<script>
	import { modelColor } from '$lib/viz/modelColors.js';

	/** @type {{ models: string[], selectedModel: string, onSelect?: (model: string) => void }} */
	let { models = [], selectedModel = '', onSelect } = $props();
</script>

<div class="model-row flex w-full flex-nowrap gap-0.5">
	{#each models as model (model)}
		{@const active = selectedModel === model}
		<button
			type="button"
			class="model-btn min-w-0 flex-1 cursor-pointer rounded-full px-1 py-2 text-[11px] font-semibold text-white transition-opacity md:text-xs {active
				? 'opacity-100'
				: 'bg-[#7a7a7a] opacity-55 hover:opacity-75'}"
			style={active ? `background-color: ${modelColor(model)};` : ''}
			aria-pressed={active}
			onclick={() => onSelect?.(model)}
		>
			{model}
		</button>
	{/each}
</div>

<style>
	.model-btn {
		flex: 1 1 0;
		min-width: 0;
		box-sizing: border-box;
	}
</style>
