<script>
	import { afterNavigate } from '$app/navigation';
	import { assetPath } from '$lib/appPaths.js';
	import './layout.css';

	let { children } = $props();

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
{@render children()}
