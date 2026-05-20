<script>
	import { onMount } from 'svelte';
	import IntroductionSlide from '$lib/introduction/IntroductionSlide.svelte';
	import IntroScrollyBackground from '$lib/introduction/IntroScrollyBackground.svelte';
	import {
		SURVEY_BG_OPACITY_PRE_SURVEY,
		SURVEY_BG_SCALE_PRE_SURVEY
	} from '$lib/introduction/introAssets.js';
	import { INTRO_SLIDES } from '$lib/introduction/introductionSlides.js';

	/** @type {{ slides?: typeof INTRO_SLIDES }} */
	let { slides = INTRO_SLIDES } = $props();

	let scrollyEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let surveyOpacity = $state(SURVEY_BG_OPACITY_PRE_SURVEY);
	let surveyScale = $state(SURVEY_BG_SCALE_PRE_SURVEY);
	const SURVEY_SCALE_MAX = 1;
	/** Survey art behind results prose (before The Questions). */
	const SURVEY_RESULTS_OPACITY = 0.1;
	/** Survey art on The Questions slide. */
	const SURVEY_QUESTIONS_OPACITY = 0.25;

	let reduceMotion = $state(false);

	/**
	 * 0 → pre-survey; 1 → full opacity on “The Survey” slide.
	 * @param {Element | null} surveySlide
	 */
	function surveyRevealProgress(surveySlide) {
		if (!surveySlide) return 0;
		const rect = surveySlide.getBoundingClientRect();
		const vh = window.innerHeight || 1;
		const fadeStart = vh * 0.9;
		if (rect.top >= fadeStart) return 0;
		if (rect.top <= 0) return 1;
		return 1 - rect.top / fadeStart;
	}

	onMount(() => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const el = scrollyEl;
		if (!el) return;

		const surveySlide = el.querySelector('[data-intro-slide="survey"]');
		const resultsSlide = el.querySelector('[data-intro-slide="results"]');
		const questionsSlide = el.querySelector('[data-intro-slide="questions"]');

		const update = () => {
			const visibleRatio = (/** @type {Element | null} */ node) => {
				if (!node) return 0;
				const rect = node.getBoundingClientRect();
				const vh = window.innerHeight || 1;
				const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
				return Math.max(0, Math.min(1, visible / Math.max(1, rect.height)));
			};

			const resultsVis = visibleRatio(resultsSlide);
			const questionsVis = visibleRatio(questionsSlide);
			const reveal = surveyRevealProgress(surveySlide);

			if (questionsVis > 0.15) {
				surveyOpacity = SURVEY_QUESTIONS_OPACITY;
				surveyScale = SURVEY_SCALE_MAX;
			} else if (resultsVis > 0.15) {
				surveyOpacity = SURVEY_RESULTS_OPACITY;
				surveyScale = SURVEY_SCALE_MAX;
			} else if (reveal >= 1) {
				surveyOpacity = 1;
				surveyScale = SURVEY_SCALE_MAX;
			} else if (reveal > 0) {
				surveyOpacity =
					SURVEY_BG_OPACITY_PRE_SURVEY +
					(1 - SURVEY_BG_OPACITY_PRE_SURVEY) * reveal;
				surveyScale =
					SURVEY_BG_SCALE_PRE_SURVEY +
					(SURVEY_SCALE_MAX - SURVEY_BG_SCALE_PRE_SURVEY) * reveal;
			} else {
				surveyOpacity = SURVEY_BG_OPACITY_PRE_SURVEY;
				surveyScale = SURVEY_BG_SCALE_PRE_SURVEY;
			}
		};

		update();
		el.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			el.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});
</script>

<IntroScrollyBackground surveyOpacity={surveyOpacity} surveyScale={surveyScale} />

<div
	bind:this={scrollyEl}
	class="intro-scrolly relative z-10 h-[100dvh] w-full overflow-y-auto overflow-x-hidden"
>
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
