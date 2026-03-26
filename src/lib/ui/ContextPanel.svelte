<script>
	import { contextTextForItem } from '$lib/data/statementContextLookup.js';

	/** @type {{ itemId: string, showStatement: boolean }} */
	let { itemId, showStatement } = $props();

	const text = $derived(contextTextForItem(itemId));
	const fallback = 'No contextual description is available for this statement.';
</script>

<div
	class="flex h-full min-h-0 w-full items-stretch rounded-md border px-3 py-3 text-xs leading-snug transition-colors {showStatement
		? 'border-slate-900 bg-slate-50 text-slate-800'
		: 'border-slate-200 bg-white text-slate-600'}"
>
	<p class="min-h-0 w-full overflow-y-auto whitespace-normal">
		{text || fallback}
	</p>
</div>
