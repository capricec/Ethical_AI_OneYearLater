<script>
	/**
	 * Shared visualization tooltip shell.
	 * Positioning is controlled by parent charts (x/y/placeLeft).
	 */
	let {
		x = 0,
		y = 0,
		maxWidth = 320,
		placeLeft = false,
		subscaleLabel = '',
		statementText = '',
		model = '',
		responseText = '',
		responseLabel = 'Average response',
		percentOfTotalText = ''
	} = $props();
</script>

<div
	class="viz-tooltip"
	style="left: {x}px; top: {y}px; max-width: {maxWidth}px; transform: {placeLeft
		? 'translateX(-100%)'
		: 'none'};"
	aria-hidden="true"
>
	{#if subscaleLabel}
		<div class="viz-tooltip-subscale">{subscaleLabel}</div>
	{/if}
	{#if statementText}
		<div class="viz-tooltip-statement">{statementText}</div>
	{/if}
	{#if model}
		<div class="viz-tooltip-model">{model}</div>
	{/if}
	{#if responseText}
		<div class="viz-tooltip-value">{responseLabel}: {responseText}</div>
	{/if}
	{#if percentOfTotalText}
		<div class="viz-tooltip-value">Percent of total: {percentOfTotalText}</div>
	{/if}
</div>

<style>
	.viz-tooltip {
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

	.viz-tooltip-subscale {
		font-size: 10px;
		font-weight: 600;
		color: #475569;
		margin-bottom: 6px;
	}

	.viz-tooltip-statement {
		color: #1c1917;
		white-space: normal;
		margin-bottom: 8px;
	}

	.viz-tooltip-model {
		font-weight: 600;
		margin-bottom: 4px;
	}

	.viz-tooltip-value {
		color: #334155;
	}
</style>
