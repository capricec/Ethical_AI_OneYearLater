<script>
	import { goto } from '$app/navigation';
	import { ROUTE_TOOL } from '$lib/routes.js';

	/** @type {{ label: string, href?: string }} */
	let { label, href = ROUTE_TOOL } = $props();

	let navigating = $state(false);

	/** @param {MouseEvent} event */
	async function enterTool(event) {
		event.preventDefault();
		if (navigating) return;
		navigating = true;
		try {
			await goto(href, { invalidateAll: true, keepFocus: false, noScroll: false });
		} catch {
			window.location.assign(href);
			return;
		}
		// Fallback if client navigation updated the URL but the view did not swap.
		requestAnimationFrame(() => {
			if (window.location.pathname === href && !document.querySelector('[data-tool-root]')) {
				window.location.assign(href);
			}
			navigating = false;
		});
	}
</script>

<a
	{href}
	data-sveltekit-preload-data="hover"
	class="relative z-30 inline-flex items-center justify-center rounded-full border border-white/80 bg-transparent px-7 py-2 text-sm font-normal text-white/95 transition-colors hover:border-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
	class:opacity-70={navigating}
	aria-busy={navigating}
	onclick={enterTool}
>
	{label}
</a>
