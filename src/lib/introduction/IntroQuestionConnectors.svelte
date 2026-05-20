<script>
	import { onMount } from 'svelte';
	import {
		questionPillInnerAnchor,
		questionsSlideVisibleEnough,
		surveyChartLayoutInContainer,
		surveySpokePoint
	} from '$lib/introduction/surveyChartLayout.js';
	import { sourceItemsForIntroDebate, surveySpokesForItemIds } from '$lib/introduction/surveyStatementSpokes.js';

	/**
	 * @typedef {import('./introductionSlides.js').IntroQuestionPlacement} IntroQuestionPlacement
	 */

	/** @type {{ placements: IntroQuestionPlacement[], activeIndex?: number }} */
	let { placements, activeIndex = -1 } = $props();

	let layerEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let layerW = $state(0);
	let layerH = $state(0);
	/** @type {{ key: string, x1: number, y1: number, x2: number, y2: number }[]} */
	let lines = $state([]);

	function syncLines() {
		const container = layerEl;
		if (!container) return;
		layerW = container.clientWidth;
		layerH = container.clientHeight;

		if (
			layerW < 1 ||
			layerH < 1 ||
			activeIndex < 0 ||
			!questionsSlideVisibleEnough(container)
		) {
			lines = [];
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const surveyImg = document.querySelector('.intro-survey-chart');
		const chart = surveyChartLayoutInContainer(surveyImg, container);
		if (!chart) {
			lines = [];
			return;
		}

		const pillEls = container.parentElement?.querySelectorAll('[data-intro-question-pill]');
		/** @type {{ key: string, x1: number, y1: number, x2: number, y2: number }[]} */
		const out = [];

		const pi = activeIndex;
		if (pi < (placements ?? []).length) {
			const placement = placements[pi];
			const pillEl = pillEls?.[pi];
			if (pillEl && pillEl instanceof HTMLElement) {
				const anchor = questionPillInnerAnchor(pillEl, containerRect, placement);
				const items = placement.debateId ? sourceItemsForIntroDebate(placement.debateId) : [];
				const spokes = surveySpokesForItemIds(items);

				for (const spoke of spokes) {
					const tip = surveySpokePoint(chart, spoke.angleRad, spoke.neutralRadiusFrac);
					out.push({
						key: `${pi}-${spoke.itemId}`,
						x1: anchor.x1,
						y1: anchor.y1,
						x2: tip.x,
						y2: tip.y
					});
				}
			}
		}

		lines = out;
	}

	onMount(() => {
		const container = layerEl;
		if (!container) return;

		syncLines();
		const ro = new ResizeObserver(syncLines);
		ro.observe(container);

		const surveyImg = document.querySelector('.intro-survey-chart');
		if (surveyImg) ro.observe(surveyImg);

		const pillsParent = container.parentElement;
		const questionsSlide = container.closest('[data-intro-slide="questions"]');
		if (questionsSlide) ro.observe(questionsSlide);

		if (pillsParent) {
			for (const pill of pillsParent.querySelectorAll('[data-intro-question-pill]')) {
				ro.observe(pill);
			}
		}

		const scrolly = document.querySelector('.intro-scrolly');
		scrolly?.addEventListener('scroll', syncLines, { passive: true });
		window.addEventListener('resize', syncLines);

		return () => {
			ro.disconnect();
			scrolly?.removeEventListener('scroll', syncLines);
			window.removeEventListener('resize', syncLines);
		};
	});

	$effect(() => {
		placements;
		activeIndex;
		syncLines();
	});
</script>

<div bind:this={layerEl} class="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
	{#if layerW > 0 && layerH > 0 && lines.length}
		<svg
			class="h-full w-full"
			width={layerW}
			height={layerH}
			viewBox="0 0 {layerW} {layerH}"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			{#each lines as line (line.key)}
				<line
					x1={line.x1}
					y1={line.y1}
					x2={line.x2}
					y2={line.y2}
					stroke="rgba(255,255,255,0.92)"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			{/each}
		</svg>
	{/if}
</div>
