<script>
	import { afterNavigate } from '$app/navigation';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	afterNavigate(() => {
		window.scrollTo(0, 0);
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
		document.body.style.overflow = '';
		document.documentElement.style.overflow = '';
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
