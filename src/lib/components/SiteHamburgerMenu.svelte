<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { appPath } from '$lib/appPaths.js';
	import {
		ROUTE_INTRO,
		ROUTE_TOOL,
		ROUTE_METHODOLOGY,
		isIntroRoute,
		isToolRoute,
		isMethodologyRoute
	} from '$lib/routes.js';

	/** @type {{ lightIcon?: boolean }} */
	let { lightIcon = false } = $props();

	let menuOpen = $state(false);
	let wrapEl = $state(/** @type {HTMLDivElement | null} */ (null));

	/** @param {string} href */
	function navItemClass(href) {
		const p = $page.url.pathname;
		const active =
			(href === ROUTE_INTRO && isIntroRoute(p)) ||
			(href === ROUTE_TOOL && isToolRoute(p)) ||
			(href === ROUTE_METHODOLOGY && isMethodologyRoute(p));
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

<div bind:this={wrapEl} class="relative shrink-0">
	<button
		type="button"
		class="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-md border border-transparent hover:bg-white/10 {lightIcon
			? 'text-white'
			: 'text-slate-900 hover:bg-slate-100'}"
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
			<a href={appPath(ROUTE_INTRO)} class={navItemClass(ROUTE_INTRO)} role="menuitem">Introduction</a>
			<a href={appPath(ROUTE_TOOL)} class={navItemClass(ROUTE_TOOL)} role="menuitem">Tool</a>
			<a href={appPath(ROUTE_METHODOLOGY)} class={navItemClass(ROUTE_METHODOLOGY)} role="menuitem"
				>Methodology</a
			>
		</div>
	{/if}
</div>
