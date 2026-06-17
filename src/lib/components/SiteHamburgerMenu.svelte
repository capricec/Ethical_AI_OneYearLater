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

	/** @type {{ lightIcon?: boolean }} */
	let { lightIcon = false } = $props();

	let menuOpen = $state(false);
	let wrapEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let menuTop = $state(0);
	let menuRight = $state(0);

	function syncMenuPosition() {
		if (!wrapEl) return;
		const btn = wrapEl.querySelector('button');
		if (!(btn instanceof HTMLElement)) return;
		const rect = btn.getBoundingClientRect();
		menuTop = rect.bottom + 4;
		menuRight = Math.max(8, window.innerWidth - rect.right);
	}

	function toggleMenu() {
		menuOpen = !menuOpen;
		if (menuOpen) syncMenuPosition();
	}

	/** @param {string} href */
	function navItemClass(href) {
		const p = $page.url.pathname;
		const active =
			(href === ROUTE_INTRO && isIntroRoute(p)) ||
			(href === ROUTE_TOOL && isToolRoute(p)) ||
			(href === ROUTE_IDEOLOGY_PROFILE && isIdeologyProfileRoute(p)) ||
			(href === ROUTE_METHODOLOGY && isMethodologyRoute(p));
		return `block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`;
	}

	function closeMenu() {
		menuOpen = false;
	}

	$effect(() => {
		$page.url.pathname;
		menuOpen = false;
	});

	onMount(() => {
		const onDoc = (/** @type {MouseEvent} */ e) => {
			const t = e.target;
			if (wrapEl && t instanceof Node && !wrapEl.contains(t)) menuOpen = false;
		};
		document.addEventListener('click', onDoc);
		return () => document.removeEventListener('click', onDoc);
	});

	$effect(() => {
		if (!menuOpen) return;
		syncMenuPosition();
		const onReposition = () => syncMenuPosition();
		window.addEventListener('resize', onReposition);
		window.addEventListener('scroll', onReposition, true);
		return () => {
			window.removeEventListener('resize', onReposition);
			window.removeEventListener('scroll', onReposition, true);
		};
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
			toggleMenu();
		}}
	>
		<span class="block h-0.5 w-5 rounded-full bg-current"></span>
		<span class="block h-0.5 w-5 rounded-full bg-current"></span>
		<span class="block h-0.5 w-5 rounded-full bg-current"></span>
	</button>
	{#if menuOpen}
		<div
			class="fixed z-[200] min-w-[12rem] rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200/80"
			style={`top: ${menuTop}px; right: ${menuRight}px;`}
			role="menu"
		>
			<a href={appPath(ROUTE_INTRO)} class={navItemClass(ROUTE_INTRO)} role="menuitem" onclick={closeMenu}
				>Introduction</a
			>
			<a href={appPath(ROUTE_TOOL)} class={navItemClass(ROUTE_TOOL)} role="menuitem" onclick={closeMenu}
				>Tool</a
			>
			<a
				href={appPath(ROUTE_IDEOLOGY_PROFILE)}
				class={navItemClass(ROUTE_IDEOLOGY_PROFILE)}
				role="menuitem"
				onclick={closeMenu}>Ideologic Profiles</a
			>
			<a
				href={ideologyProfileQuizHref()}
				class="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
				role="menuitem"
				onclick={closeMenu}>Take the quiz</a
			>
			<a
				href={appPath(ROUTE_METHODOLOGY)}
				class={navItemClass(ROUTE_METHODOLOGY)}
				role="menuitem"
				onclick={closeMenu}>Methodology</a
			>
		</div>
	{/if}
</div>
