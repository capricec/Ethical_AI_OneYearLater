<script>
	import IntroBackground from '$lib/introduction/IntroBackground.svelte';
	import IntroRadialMotif from '$lib/introduction/IntroRadialMotif.svelte';
	import IntroSiteMenu from '$lib/introduction/IntroSiteMenu.svelte';
	import IntroductionScrolly from '$lib/introduction/IntroductionScrolly.svelte';
	import { INTRO_BACKGROUND_SRC } from '$lib/introduction/introductionSlides.js';
</script>

<svelte:head>
	<title>Introduction — Everyday Ethics of AI</title>
</svelte:head>

<div class="relative h-[100dvh] w-full overflow-hidden bg-[#333333] text-white">
	<IntroBackground src={INTRO_BACKGROUND_SRC} />
	{#if !INTRO_BACKGROUND_SRC}
		<IntroRadialMotif />
	{/if}
	<IntroSiteMenu />
	<IntroductionScrolly />
</div>
