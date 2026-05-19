<script>
	import IntroductionSlide from '$lib/introduction/IntroductionSlide.svelte';
	import { INTRO_SLIDES } from '$lib/introduction/introductionSlides.js';

	/** @type {{ slides?: typeof INTRO_SLIDES }} */
	let { slides = INTRO_SLIDES } = $props();
</script>

<div class="intro-scrolly relative z-10 h-[100dvh] w-full overflow-y-auto overflow-x-hidden">
	{#each slides as slide (slide.id)}
		<IntroductionSlide {slide} />
	{/each}
</div>

<style>
	.intro-scrolly {
		scroll-snap-type: y mandatory;
		-webkit-overflow-scrolling: touch;
	}

	:global(.intro-slide) {
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	@media (prefers-reduced-motion: reduce) {
		.intro-scrolly {
			scroll-snap-type: none;
		}

		:global(.intro-slide) {
			scroll-snap-stop: normal;
		}
	}
</style>
