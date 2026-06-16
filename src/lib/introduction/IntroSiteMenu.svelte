<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { appPath } from '$lib/appPaths.js';
	import {
		ROUTE_INTRO,
		ROUTE_TOOL,
		ROUTE_IDEOLOGY_PROFILE,
		ROUTE_METHODOLOGY,
		ideologyProfileQuizHref,
		isIntroRoute,
		isToolRoute,
		isIdeologyProfileRoute,
		isMethodologyRoute
	} from '$lib/routes.js';

	let menuOpen = $state(false);
	let wrapEl = $state(/** @type {HTMLDivElement | null} */ (null));

	/** @param {string} href */
	function navItemClass(href) {
		const p = $page.url.pathname;
		const active =
			(href === ROUTE_INTRO && isIntroRoute(p)) ||
			(href === ROUTE_TOOL && isToolRoute(p)) ||
			(href === ROUTE_IDEOLOGY_PROFILE && isIdeologyProfileRoute(p)) ||
			(href === ROUTE_METHODOLOGY && isMethodologyRoute(p));
		return `block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${active ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10'}`;
	}

	onMount(() => {
		const onDoc = (/** @type {MouseEvent} */ e) => {
			const t = e.target;
			if (wrapEl && t instanceof Node && !wrapEl.contains(t)) menuOpen = false;
		};
		const onKey = (/** @type {KeyboardEvent} */ e) => {
			if (e.key === 'Escape') menuOpen = false;
		};
		document.addEventListener('click', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div bind:this={wrapEl} class="fixed top-0 right-0 z-50 p-4 md:p-5">
	<div class="relative">
		<button
			type="button"
			class="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-md text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
				class="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-white/10 bg-[#2a2a2a]/95 py-1 shadow-lg backdrop-blur-sm"
				role="menu"
			>
				<a href={appPath(ROUTE_INTRO)} class={navItemClass(ROUTE_INTRO)} role="menuitem">Introduction</a>
				<a href={appPath(ROUTE_TOOL)} class={navItemClass(ROUTE_TOOL)} role="menuitem">Tool</a>
				<a
					href={appPath(ROUTE_IDEOLOGY_PROFILE)}
					class={navItemClass(ROUTE_IDEOLOGY_PROFILE)}
					role="menuitem">Ideologic Profiles</a
				>
				<a
					href={ideologyProfileQuizHref()}
					class="block w-full px-4 py-2.5 text-left text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
					role="menuitem">Ideology Quiz</a
				>
				<a href={appPath(ROUTE_METHODOLOGY)} class={navItemClass(ROUTE_METHODOLOGY)} role="menuitem"
					>Methodology</a
				>
			</div>
		{/if}
	</div>
</div>
