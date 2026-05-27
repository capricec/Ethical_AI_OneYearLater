<script>
	import { goto } from '$app/navigation';
	import { appPath } from '$lib/appPaths.js';
	import { ROUTE_TOOL } from '$lib/routes.js';

	/** @type {{ label: string, href?: string, pill?: boolean, outlinePill?: boolean }} */
	let { label, href = ROUTE_TOOL, pill = false, outlinePill = false } = $props();

	let navigating = $state(false);
	const resolvedHref = $derived(appPath(href));

	const pillClass =
		'rounded-full bg-[#212121] px-6 py-3.5 text-sm font-normal leading-none text-white shadow-sm transition-opacity hover:bg-[#2a2a2a] md:px-7 md:py-4';
	const outlinePillClass =
		'rounded-full border border-white bg-[#212121]/50 px-6 py-2 text-sm font-normal leading-none text-white shadow-sm backdrop-blur-sm transition-colors hover:border-white hover:bg-[#212121]/80 md:px-7 md:py-2.5';
	const outlineClass =
		'rounded-full border border-white/80 bg-transparent px-7 py-2 text-sm font-normal text-white/95 transition-colors hover:border-white hover:text-white';

	const buttonClass = $derived(
		outlinePill ? outlinePillClass : pill ? pillClass : outlineClass
	);

	/** @param {MouseEvent} event */
	async function enterTool(event) {
		event.preventDefault();
		if (navigating) return;
		navigating = true;
		try {
			await goto(resolvedHref, { invalidateAll: true, keepFocus: false, noScroll: false });
		} catch {
			window.location.assign(resolvedHref);
			return;
		}
		requestAnimationFrame(() => {
			if (window.location.pathname === resolvedHref && !document.querySelector('[data-tool-root]')) {
				window.location.assign(resolvedHref);
			}
			navigating = false;
		});
	}
</script>

<a
	href={resolvedHref}
	data-sveltekit-preload-data="hover"
	class="relative z-30 inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white {buttonClass}"
	class:opacity-70={navigating}
	aria-busy={navigating}
	onclick={enterTool}
>
	{label}
</a>
