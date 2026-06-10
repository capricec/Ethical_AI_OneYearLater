<script>
	/** @type {{
		title: string,
		description: string,
		similarityPct: number,
		bubbleColor?: string,
		isCustom?: boolean,
		onRemove?: (() => void) | undefined
	}} */
	let {
		title,
		description,
		similarityPct,
		bubbleColor = '#785EF0',
		isCustom = false,
		onRemove = undefined
	} = $props();
</script>

<article
	class="relative flex items-start gap-3 rounded-xl bg-white px-3 py-3 shadow-sm transition-shadow hover:shadow-md md:px-4 md:py-3.5"
	class:pr-10={isCustom && onRemove}
>
	{#if isCustom && onRemove}
		<button
			type="button"
			class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:right-2.5 md:top-2.5"
			aria-label="Remove custom profile from ranking"
			onclick={() => onRemove?.()}
		>
			×
		</button>
	{/if}
	<div
		class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white md:h-12 md:w-12"
		style={`background-color: ${bubbleColor};`}
		aria-hidden="true"
	>
		{similarityPct}%
	</div>
	<div class="min-w-0 flex-1">
		<h3 class="text-sm font-bold text-slate-900 md:text-base">
			{title}
			{#if isCustom}
				<span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-500">(you)</span>
			{/if}
		</h3>
		{#if description}
			<p class="mt-0.5 text-xs leading-snug text-slate-600 md:text-sm">{description}</p>
		{/if}
	</div>
</article>
