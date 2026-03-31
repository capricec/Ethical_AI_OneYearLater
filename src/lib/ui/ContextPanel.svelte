<script>
	import { contextTextForItem } from '$lib/data/statementContextLookup.js';

	/** @type {{ itemId: string, showStatement: boolean }} */
	let { itemId, showStatement } = $props();

	const text = $derived(contextTextForItem(itemId));
	const fallback = 'No contextual description is available for this statement.';
</script>

<div class="flex h-full min-h-0 w-full items-stretch px-3 py-3 text-xs leading-snug">
	<p class="min-h-0 w-full overflow-y-auto whitespace-normal text-slate-700">
		{text || fallback}
	</p>
</div>
