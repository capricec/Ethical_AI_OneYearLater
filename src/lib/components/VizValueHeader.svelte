<script>
	/** @type {{ valueText?: string, onClearValue?: (() => void) | undefined }} */
	let { valueText = '', onClearValue = undefined } = $props();
</script>

{#if valueText}
	<div
		class="relative z-30 shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 md:px-5 md:py-3"
	>
		<div class="flex min-w-0 items-center gap-2">
			<p class="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900 md:text-base">
				{valueText}
			</p>
			{#if onClearValue}
				<button
					type="button"
					class="shrink-0 text-base leading-none text-slate-400 hover:text-slate-700"
					onclick={onClearValue}
					aria-label="Clear selected statement"
				>
					×
				</button>
			{/if}
		</div>
	</div>
{/if}
