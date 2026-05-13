<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { modelColor } from '$lib/viz/modelColors.js';

	/** @type {{ questionText?: string, valueText?: string, compareModels?: string[], transparentBackground?: boolean, onClearQuestion?: (() => void) | undefined, onClearValue?: (() => void) | undefined }} */
	let {
		questionText = '',
		valueText = '',
		compareModels = [],
		transparentBackground = false,
		onClearQuestion = undefined,
		onClearValue = undefined
	} = $props();

	let menuOpen = $state(false);
	let wrapEl = $state(/** @type {HTMLDivElement | null} */ (null));

	const compareDebateHeader = $derived(
		$page.url.pathname !== '/introduction' &&
			$page.url.pathname !== '/methodology' &&
			compareModels.length === 2 &&
			Boolean(String(questionText ?? '').trim())
	);

	/** Radial/tool: VALUE line without QUESTION — align that row with the hamburger column. */
	const valueOnlyNavRow = $derived(
		!Boolean(String(questionText ?? '').trim()) && Boolean(String(valueText ?? '').trim())
	);

	/** Debate question chosen but not yet two compare models — match first-row vertical alignment vs controls. */
	const questionOnlyAwaitingCompare = $derived(
		$page.url.pathname !== '/introduction' &&
			$page.url.pathname !== '/methodology' &&
			Boolean(String(questionText ?? '').trim()) &&
			compareModels.length < 2 &&
			!Boolean(String(valueText ?? '').trim())
	);

	/** @param {string} href */
	function navItemClass(href) {
		const p = $page.url.pathname;
		const active =
			(href === '/introduction' && p === '/introduction') ||
			(href === '/methodology' && p === '/methodology') ||
			(href === '/' && (p === '/' || p === ''));
		return `block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`;
	}

	onMount(() => {
		const onDoc = (/** @type {MouseEvent} */ e) => {
			const t = e.target;
			if (wrapEl && t instanceof Node && !wrapEl.contains(t)) menuOpen = false;
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});
</script>

<div
	bind:this={wrapEl}
	class="w-full shrink-0 px-4 py-3"
	class:bg-white={!transparentBackground}
	class:bg-transparent={transparentBackground}
>
	{#if $page.url.pathname === '/introduction'}
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1 space-y-1 pr-2">
				<p class="text-base font-bold text-slate-900">Introduction</p>
				<p class="text-sm font-semibold text-slate-600">Everyday Ethics of AI</p>
			</div>
			<div class="relative">
				<button
					type="button"
					class="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-md border border-transparent text-slate-900 hover:bg-slate-100"
					aria-expanded={menuOpen}
					aria-haspopup="true"
					aria-label="Site menu"
					onclick={(e) => {
						e.stopPropagation();
						menuOpen = !menuOpen;
					}}
				>
					<span class="block h-0.5 w-5 rounded-full bg-current"></span>
					<span class="block h-0.5 w-5 rounded-full bg-current"></span>
					<span class="block h-0.5 w-5 rounded-full bg-current"></span>
				</button>
				{#if menuOpen}
					<div
						class="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg bg-white py-1 shadow-lg"
						role="menu"
					>
						<a href="/introduction" class={navItemClass('/introduction')} role="menuitem">Introduction</a>
						<a href="/" class={navItemClass('/')} role="menuitem">Tool</a>
						<a href="/methodology" class={navItemClass('/methodology')} role="menuitem">Methodology</a>
					</div>
				{/if}
			</div>
		</div>
	{:else if $page.url.pathname === '/methodology'}
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1 space-y-1 pr-2">
				<p class="text-base font-bold text-slate-900">Methodology</p>
				<p class="text-sm font-semibold text-slate-600">Everyday Ethics of AI</p>
			</div>
			<div class="relative">
				<button
					type="button"
					class="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-md border border-transparent text-slate-900 hover:bg-slate-100"
					aria-expanded={menuOpen}
					aria-haspopup="true"
					aria-label="Site menu"
					onclick={(e) => {
						e.stopPropagation();
						menuOpen = !menuOpen;
					}}
				>
					<span class="block h-0.5 w-5 rounded-full bg-current"></span>
					<span class="block h-0.5 w-5 rounded-full bg-current"></span>
					<span class="block h-0.5 w-5 rounded-full bg-current"></span>
				</button>
				{#if menuOpen}
					<div
						class="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg bg-white py-1 shadow-lg"
						role="menu"
					>
						<a href="/introduction" class={navItemClass('/introduction')} role="menuitem">Introduction</a>
						<a href="/" class={navItemClass('/')} role="menuitem">Tool</a>
						<a href="/methodology" class={navItemClass('/methodology')} role="menuitem">Methodology</a>
					</div>
				{/if}
			</div>
		</div>
	{:else if compareDebateHeader}
		<div
			class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2"
		>
			<div class="min-w-0">
				<p class="text-base font-bold leading-snug text-slate-900">
					{questionText}
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-2 sm:gap-3">
				<div class="flex items-center gap-1.5">
					<div
						class="min-w-[5.5rem] rounded-full px-3 py-1.5 text-center text-xs font-bold text-slate-900"
						style={`background-color: ${modelColor(compareModels[0])};`}
					>
						{compareModels[0]}
					</div>
					<span class="text-xs font-semibold lowercase text-slate-900">vs</span>
					<div
						class="min-w-[5.5rem] rounded-full px-3 py-1.5 text-center text-xs font-bold text-slate-900"
						style={`background-color: ${modelColor(compareModels[1])};`}
					>
						{compareModels[1]}
					</div>
				</div>
				{#if onClearQuestion}
					<button
						type="button"
						class="shrink-0 text-base leading-none text-slate-400 hover:text-slate-700"
						onclick={onClearQuestion}
						aria-label="Clear selected question"
					>
						×
					</button>
				{/if}
				<div class="relative">
					<button
						type="button"
						class="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-md border border-transparent text-slate-900 hover:bg-slate-100"
						aria-expanded={menuOpen}
						aria-haspopup="true"
						aria-label="Site menu"
						onclick={(e) => {
							e.stopPropagation();
							menuOpen = !menuOpen;
						}}
					>
						<span class="block h-0.5 w-5 rounded-full bg-current"></span>
						<span class="block h-0.5 w-5 rounded-full bg-current"></span>
						<span class="block h-0.5 w-5 rounded-full bg-current"></span>
					</button>
					{#if menuOpen}
						<div
							class="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg bg-white py-1 shadow-lg"
							role="menu"
						>
							<a href="/introduction" class={navItemClass('/introduction')} role="menuitem">Introduction</a>
							<a href="/" class={navItemClass('/')} role="menuitem">Tool</a>
							<a href="/methodology" class={navItemClass('/methodology')} role="menuitem">Methodology</a>
						</div>
					{/if}
				</div>
			</div>
			{#if valueText}
				<div class="col-span-2 flex min-w-0 items-start gap-2 border-t border-slate-100 pt-2">
					<p class="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900">
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
			{/if}
		</div>
	{:else}
		<div
			class="flex w-full justify-between gap-4"
			class:items-center={valueOnlyNavRow || questionOnlyAwaitingCompare}
			class:items-start={!valueOnlyNavRow && !questionOnlyAwaitingCompare}
		>
			<div class="min-w-0 flex-1 space-y-1 pr-2">
				{#if questionText}
					<div
						class="flex gap-2"
						class:items-center={questionOnlyAwaitingCompare}
						class:items-start={!questionOnlyAwaitingCompare}
					>
						<p class="min-w-0 flex-1 text-base font-bold leading-snug text-slate-900">
							{questionText}
						</p>
						{#if onClearQuestion}
							<button
								type="button"
								class="shrink-0 text-base leading-none text-slate-400 hover:text-slate-700"
								onclick={onClearQuestion}
								aria-label="Clear selected question"
							>
								×
							</button>
						{/if}
					</div>
				{/if}
				{#if valueText}
					<div
						class="flex min-w-0 gap-2"
						class:items-center={valueOnlyNavRow}
						class:items-start={!valueOnlyNavRow}
					>
						<p class="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-900">
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
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-3">
				{#if compareModels.length === 2}
					<div class="flex items-center gap-1.5">
						<div
							class="min-w-[5.5rem] rounded-full px-3 py-1.5 text-center text-xs font-bold text-slate-900"
							style={`background-color: ${modelColor(compareModels[0])};`}
						>
							{compareModels[0]}
						</div>
						<span class="text-xs font-semibold lowercase text-slate-900">vs</span>
						<div
							class="min-w-[5.5rem] rounded-full px-3 py-1.5 text-center text-xs font-bold text-slate-900"
							style={`background-color: ${modelColor(compareModels[1])};`}
						>
							{compareModels[1]}
						</div>
					</div>
				{/if}

				<div class="relative">
					<button
						type="button"
						class="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-md border border-transparent text-slate-900 hover:bg-slate-100"
						aria-expanded={menuOpen}
						aria-haspopup="true"
						aria-label="Site menu"
						onclick={(e) => {
							e.stopPropagation();
							menuOpen = !menuOpen;
						}}
					>
						<span class="block h-0.5 w-5 rounded-full bg-current"></span>
						<span class="block h-0.5 w-5 rounded-full bg-current"></span>
						<span class="block h-0.5 w-5 rounded-full bg-current"></span>
					</button>

					{#if menuOpen}
						<div
							class="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg bg-white py-1 shadow-lg"
							role="menu"
						>
							<a href="/introduction" class={navItemClass('/introduction')} role="menuitem">Introduction</a>
							<a href="/" class={navItemClass('/')} role="menuitem">Tool</a>
							<a href="/methodology" class={navItemClass('/methodology')} role="menuitem">Methodology</a>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
