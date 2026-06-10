<script>
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { assetPath } from '$lib/appPaths.js';
	import { closeIdeologyBuilder } from '$lib/stores/ideologyProfileState.js';
	import './layout.css';

	let { children } = $props();

	beforeNavigate(() => {
		closeIdeologyBuilder();
	});

	afterNavigate(() => {
		window.scrollTo(0, 0);
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
		document.body.style.overflow = '';
		document.documentElement.style.overflow = '';
	});
</script>

<svelte:head>
	<link rel="icon" href={assetPath('/favicon.png')} type="image/png" />
</svelte:head>

{#key $page.url.pathname}
	{@render children()}
{/key}
