<script>
	const STATEMENT_BLURB =
		'This statement is designed to measure attitudes toward authority, expertise, and populism in politics.';

	/** @type {{ showStatement: boolean }} */
	let { showStatement } = $props();
</script>

<div
	class="h-full w-full flex items-start rounded-md border px-3 py-3 text-xs leading-snug transition-colors {showStatement
		? 'border-slate-900 bg-slate-50 text-slate-700'
		: 'border-slate-200 bg-white text-slate-600'}"
>
	<p class="line-clamp-2 w-full">{STATEMENT_BLURB}</p>
</div>
