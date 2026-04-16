<script>
	/**
	 * Shared visualization tooltip shell.
	 * Positioning is controlled by parent charts (x/y/placeLeft).
	 * @type {'default' | 'radial-all' | 'radial-model'}
	 */
	let {
		x = 0,
		y = 0,
		maxWidth = 320,
		/** When set, tooltip uses this fixed width (px). */
		fixedWidth = null,
		placeLeft = false,
		variant = 'default',
		subscaleLabel = '',
		statementText = '',
		model = '',
		responseText = '',
		responseLabel = 'Average response',
		percentOfTotalText = '',
		metaLine = '',
		radialHintText = 'Click for more information'
	} = $props();

	const w = $derived(fixedWidth != null && fixedWidth > 0 ? fixedWidth : maxWidth);
</script>

<div
	class="viz-tooltip"
	class:viz-tooltip--fixed={fixedWidth != null && fixedWidth > 0}
	style="left: {x}px; top: {y}px; width: {w}px; max-width: {w}px; transform: {placeLeft
		? 'translateX(-100%)'
		: 'none'};"
	aria-hidden="true"
>
	{#if variant === 'radial-all'}
		<div class="viz-tooltip-kicker viz-tooltip-kicker--tight">STATEMENT</div>
		{#if statementText}
			<div class="viz-tooltip-statement viz-tooltip-statement--radial">{statementText}</div>
		{/if}
		<div class="viz-tooltip-hint">{radialHintText}</div>
	{:else if variant === 'radial-model'}
		<div class="viz-tooltip-kicker viz-tooltip-kicker--tight">STATEMENT</div>
		{#if statementText}
			<div class="viz-tooltip-statement viz-tooltip-statement--radial">{statementText}</div>
		{/if}
		{#if model}
			<div class="viz-tooltip-kicker viz-tooltip-kicker--tight viz-tooltip-kicker--section">
				{model} — average response
			</div>
			<div class="viz-tooltip-statement viz-tooltip-statement--radial">{responseText || '—'}</div>
		{/if}
	{:else}
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
		{#if metaLine}
			<div class="viz-tooltip-value">{metaLine}</div>
		{/if}
	{/if}
</div>

<style>
	.viz-tooltip {
		position: absolute;
		pointer-events: none;
		min-width: 120px;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid #d6d3d1;
		background: rgba(255, 255, 255, 0.96);
		color: #1c1917;
		font-size: 11px;
		line-height: 1.35;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
		z-index: 50;
		box-sizing: border-box;
	}

	.viz-tooltip--fixed {
		min-width: 0;
	}

	.viz-tooltip-kicker {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #64748b;
		text-transform: uppercase;
		margin-bottom: 6px;
	}

	.viz-tooltip-kicker--tight {
		margin-bottom: 2px;
	}

	/** Second label block (model / average response) after the statement. */
	.viz-tooltip-kicker--section {
		margin-top: 10px;
		margin-bottom: 2px;
	}

	.viz-tooltip-hint {
		margin-top: 8px;
		font-size: 9px;
		line-height: 1.3;
		color: #64748b;
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

	.viz-tooltip-statement--radial {
		margin-bottom: 0;
	}

	.viz-tooltip-model {
		font-weight: 600;
		margin-bottom: 4px;
	}

	.viz-tooltip-value {
		color: #334155;
	}
</style>
