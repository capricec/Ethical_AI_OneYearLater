<script>
	const STATEMENT_BLURB =
		'This statement is designed to measure attitudes toward authority, expertise, and populism in politics.';

	const AGGREGATE_BLURB =
		'The overall position sums averaged responses across every statement in this dimension (one mean per item per model, then summed).';

	/** @type {{ showAggregate: boolean, showStatement: boolean }} */
	let { showAggregate, showStatement } = $props();
</script>

{#if showAggregate}
	<!-- Grey placeholder (overall row) - no full card for aggregate. -->
	<div class="h-full w-full flex items-center">
		<div class="h-3.5 w-full rounded-md bg-slate-200/70"></div>
	</div>
{:else}
	<div
		class="h-full w-full flex items-start rounded-md border px-3 py-3 text-xs leading-snug transition-colors {showStatement
			? 'border-slate-900 bg-slate-50 text-slate-700'
			: 'border-slate-200 bg-white text-slate-600'}"
	>
		<p class="line-clamp-2 w-full">{STATEMENT_BLURB}</p>
	</div>
{/if}
