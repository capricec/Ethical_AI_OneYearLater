<script>
	import { tick } from 'svelte';

	const PLACEHOLDER = 'WHAT QUESTIONS ARE YOU ASKING AI?';

	/** @type {{ topics?: { id: string, label: string }[], selectedDebateId?: string | null, onSelect?: (debateId: string | null) => void }} */
	let { topics = [], selectedDebateId = null, onSelect } = $props();

	let open = $state(false);
	let wrapEl = $state(/** @type {HTMLDivElement | null} */ (null));

	const selectedLabel = $derived(
		selectedDebateId
			? topics.find((t) => t.id === selectedDebateId)?.label ??
				String(selectedDebateId)
			: ''
	);

	const displayText = $derived(selectedLabel || PLACEHOLDER);
	const hasSelection = $derived(Boolean(String(selectedDebateId ?? '').trim()));

	/** @param {string} debateId */
	function pickTopic(debateId) {
		open = false;
		onSelect?.(debateId);
	}

	async function clearSelection() {
		open = false;
		onSelect?.(null);
		await tick();
		open = true;
	}

	/** @param {MouseEvent} e */
	function handleDocumentClick(e) {
		const t = e.target;
		if (wrapEl && t instanceof Node && !wrapEl.contains(t)) open = false;
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('click', handleDocumentClick);
		return () => document.removeEventListener('click', handleDocumentClick);
	});
</script>

<div bind:this={wrapEl} class="relative min-w-0 flex-1">
	<button
		type="button"
		class="flex min-h-9 w-full items-center rounded-full bg-white py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm md:min-h-12 md:px-5 md:py-2.5 md:text-sm {hasSelection
			? 'pl-4 pr-10 normal-case tracking-normal font-bold'
			: 'px-4'}"
		aria-expanded={open}
		aria-haspopup="listbox"
		onclick={() => {
			open = !open;
		}}
	>
		<span class="min-w-0 w-full truncate text-center">{displayText}</span>
	</button>
	{#if hasSelection}
		<button
			type="button"
			class="absolute right-1 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-sm leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:right-1.5 md:h-7 md:w-7 md:text-base"
			aria-label="Clear selected question"
			onclick={(e) => {
				e.stopPropagation();
				clearSelection();
			}}
		>
			×
		</button>
	{/if}
	{#if open}
		<ul
			class="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
			role="listbox"
		>
			{#each topics as topic (topic.id)}
				<li role="presentation">
					<button
						type="button"
						class="w-full px-4 py-3 text-left text-sm text-slate-800 hover:bg-slate-100 {selectedDebateId ===
						topic.id
							? 'bg-slate-50 font-semibold'
							: ''}"
						role="option"
						aria-selected={selectedDebateId === topic.id}
						onclick={() => pickTopic(topic.id)}
					>
						{topic.label}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
