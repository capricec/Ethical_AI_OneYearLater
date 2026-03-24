<script>
	/** @type {{ key: string, label: string, description?: string }[]} */
	let { subscales } = $props();
</script>

<ul class="list-none space-y-3 p-3 text-slate-800">
	{#each subscales as s (s.key)}
		<li class="rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
			<div class="text-sm font-semibold leading-snug text-slate-900">{s.label}</div>
			{#if s.description}
				<p class="mt-2 text-xs leading-relaxed text-slate-600">{s.description}</p>
			{/if}
		</li>
	{/each}
</ul>
