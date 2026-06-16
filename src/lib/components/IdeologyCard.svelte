<script>
	/** @type {{
		title: string,
		description: string,
		similarityPct: number,
		bubbleColor?: string,
		isCustom?: boolean,
		onRemove?: (() => void) | undefined,
		onRefine?: (() => void) | undefined
	}} */
	let {
		title,
		description,
		similarityPct,
		bubbleColor = '#785EF0',
		isCustom = false,
		onRemove = undefined,
		onRefine = undefined
	} = $props();
</script>

<article
	class="rounded-xl bg-white px-3 py-3 shadow-sm transition-shadow hover:shadow-md md:px-4 md:py-3.5"
>
	<div class="flex items-start gap-3">
		<div
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white md:h-12 md:w-12"
			style={`background-color: ${bubbleColor};`}
			aria-hidden="true"
		>
			{similarityPct}%
		</div>
		<div class="min-w-0 flex-1">
			{#if isCustom}
				<div class="flex items-center gap-2">
					<h3 class="min-w-0 shrink text-sm font-bold text-slate-900 md:text-base">
						{title}
						<span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-500">(you)</span>
					</h3>
					{#if onRefine}
						<button
							type="button"
							class="ml-auto shrink-0 translate-y-[2px] text-xs font-semibold leading-none text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
							onclick={() => onRefine?.()}
						>
							Refine in builder
						</button>
					{/if}
					{#if onRemove}
						<button
							type="button"
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
							aria-label="Remove custom profile from ranking"
							onclick={() => onRemove?.()}
						>
							×
						</button>
					{/if}
				</div>
			{:else}
				<h3 class="text-sm font-bold text-slate-900 md:text-base">{title}</h3>
			{/if}
			{#if description}
				<p class="mt-0.5 text-xs leading-snug text-slate-600 md:text-sm">{description}</p>
			{/if}
		</div>
	</div>
</article>
