<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import IntroEnterToolCta from '$lib/introduction/IntroEnterToolCta.svelte';
	import IntroQuestionConnectors from '$lib/introduction/IntroQuestionConnectors.svelte';
	import { appPath } from '$lib/appPaths.js';
	import { queueIntroToolDeepLink } from '$lib/introduction/introToolDeepLink.js';
	import { ROUTE_TOOL } from '$lib/routes.js';
	import { MODEL_ORDER, modelColor } from '$lib/viz/modelColors.js';

	/** @type {import('./introductionSlides.js').IntroSlide} */
	let { slide } = $props();

	const proseClass = 'text-base font-normal leading-relaxed text-white/95 md:text-lg';
	const MOBILE_VIEWPORT_MQ = '(max-width: 767px)';

	/** Question pill fill on the questions slide. */
	const questionPillClass =
		'whitespace-nowrap rounded-full bg-[#212121] px-5 py-3.5 text-left text-xs leading-none text-white shadow-sm md:px-6 md:py-4 md:text-sm';

	/** The Models slide — shared pill chrome; width set per breakpoint below. */
	const introModelPillBase =
		'flex min-h-8 shrink-0 grow-0 items-center justify-center rounded-full px-3 py-2 text-center text-xs font-semibold leading-tight text-white sm:min-h-9 sm:text-sm';
	/** Mobile: fixed width for 3-column wrap (two gaps × 0.625rem). */
	const introModelPillMobileClass =
		introModelPillBase + ' w-[calc((100%-1.25rem)/3)] max-w-[calc((100%-1.25rem)/3)]';
	const introModelPillDesktopClass = introModelPillBase + ' w-full md:px-3';

	/** @param {import('./introductionSlides.js').IntroQuestionPlacement} placement */
	function placementStyle(placement) {
		return [
			placement.top != null ? `top: ${placement.top}` : '',
			placement.left != null ? `left: ${placement.left}` : '',
			placement.right != null ? `right: ${placement.right}` : '',
			placement.bottom != null ? `bottom: ${placement.bottom}` : ''
		]
			.filter(Boolean)
			.join('; ');
	}

	const questionPlacements = $derived(
		slide.questionPlacements ??
			(slide.questions ?? []).map((text, i) => ({
				text,
				top: `${12 + i * 18}%`,
				left: i % 2 === 0 ? '5%' : undefined,
				right: i % 2 === 1 ? '5%' : undefined,
			}))
	);

	let viewportMobile = $state(false);
	let navigatingToTool = $state(false);

	onMount(() => {
		const mq = window.matchMedia(MOBILE_VIEWPORT_MQ);
		const sync = () => {
			viewportMobile = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	const defaultQuestionIndex = $derived.by(() => {
		if (slide.type !== 'questions') return -1;
		const debateId = viewportMobile
			? (slide.defaultHoveredDebateIdMobile ??
				slide.defaultHoveredDebateId ??
				'income_inequality')
			: (slide.defaultHoveredDebateIdDesktop ??
				slide.defaultHoveredDebateId ??
				'speech_vs_harm');
		const idx = questionPlacements.findIndex((p) => p.debateId === debateId);
		return idx >= 0 ? idx : Math.max(0, questionPlacements.length - 1);
	});

	/** Hover overrides default. */
	let hoveredQuestionIndex = $state(/** @type {number | null} */ (null));

	const activeQuestionIndex = $derived(
		hoveredQuestionIndex ?? defaultQuestionIndex
	);

	const questionPillHoverClass = 'cursor-pointer transition-shadow duration-200';

	/** @param {import('./introductionSlides.js').IntroQuestionPlacement} placement */
	async function openQuestionInTool(placement) {
		const debateId = String(placement.debateId ?? '').trim();
		if (!debateId || navigatingToTool) return;
		navigatingToTool = true;
		queueIntroToolDeepLink(debateId);
		try {
			await goto(appPath(ROUTE_TOOL), { invalidateAll: true, keepFocus: false, noScroll: false });
		} catch {
			window.location.assign(appPath(ROUTE_TOOL));
		} finally {
			navigatingToTool = false;
		}
	}
</script>

<section
	class="intro-slide relative z-10 flex min-h-[100dvh] w-full snap-start snap-always flex-col items-center justify-center px-6 py-16 md:px-10"
	class:!px-0={slide.type === 'questions'}
	class:!py-0={slide.type === 'questions'}
	data-intro-slide={slide.id}
	aria-labelledby={slide.title ? `intro-${slide.id}-heading` : undefined}
>
	{#if slide.type === 'title'}
		<h1
			id="intro-{slide.id}-heading"
			class="max-w-3xl text-center text-2xl font-bold leading-tight text-white md:text-4xl"
		>
			{slide.title}
		</h1>
	{:else if slide.type === 'prose'}
		<div class="max-w-xl space-y-6 text-center md:max-w-2xl">
			{#each slide.paragraphs ?? [] as paragraph, i (i)}
				<p class={proseClass}>{paragraph}</p>
			{/each}
		</div>
	{:else if slide.type === 'models'}
		<div class="flex w-full max-w-3xl flex-col items-center gap-7 px-4 text-center">
			<h2
				id="intro-{slide.id}-heading"
				class="text-2xl font-bold text-white md:text-3xl"
			>
				{slide.title}
			</h2>
			<!-- Mobile: equal fixed-width pills; second row centered via flex-wrap -->
			<div
				class="mx-auto flex w-full max-w-md flex-wrap justify-center gap-2.5 md:hidden"
			>
				{#each MODEL_ORDER as model (model)}
					<span
						class={introModelPillMobileClass}
						style:background-color={modelColor(model)}
					>
						{model}
					</span>
				{/each}
			</div>
			<!-- Desktop: one row, five equal columns -->
			<div class="mx-auto hidden w-full max-w-3xl grid-cols-5 gap-2 md:grid">
				{#each MODEL_ORDER as model (model)}
					<span
						class={introModelPillDesktopClass}
						style:background-color={modelColor(model)}
					>
						{model}
					</span>
				{/each}
			</div>
		</div>
	{:else if slide.type === 'survey'}
		<h2
			id="intro-{slide.id}-heading"
			class="max-w-3xl text-center text-2xl font-bold leading-tight text-white md:text-4xl"
		>
			{slide.title}
		</h2>
	{:else if slide.type === 'questions'}
		<div class="relative h-[100dvh] w-full overflow-hidden">
			<IntroQuestionConnectors
				placements={questionPlacements}
				activeIndex={activeQuestionIndex}
			/>
			<h2
				id="intro-{slide.id}-heading"
				class="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center text-2xl font-bold text-white md:text-3xl"
			>
				{slide.title}
			</h2>
			{#each questionPlacements as placement, i (i)}
				<button
					type="button"
					data-intro-question-pill={i}
					class="absolute z-20 border-0 {questionPillClass} {questionPillHoverClass} {activeQuestionIndex === i
						? 'ring-2 ring-white/90 shadow-md'
						: ''}"
					class:opacity-70={navigatingToTool}
					style={placementStyle(placement)}
					onpointerenter={() => (hoveredQuestionIndex = i)}
					onpointerleave={() => (hoveredQuestionIndex = null)}
					onfocusin={() => (hoveredQuestionIndex = i)}
					onfocusout={() => (hoveredQuestionIndex = null)}
					onclick={() => openQuestionInTool(placement)}
				>
					{placement.text}
				</button>
			{/each}
		</div>
	{:else if slide.type === 'results'}
		<div class="flex max-w-xl flex-col items-center gap-8 text-center md:max-w-2xl">
			<div class="space-y-6">
				<h2
					id="intro-{slide.id}-heading"
					class="text-2xl font-bold text-white md:text-3xl"
				>
					{slide.title}
				</h2>
				{#each slide.paragraphs ?? [] as paragraph, i (i)}
					<p class={proseClass}>{paragraph}</p>
				{/each}
			</div>
			{#if slide.cta}
				<IntroEnterToolCta label={slide.cta.label} href={slide.cta.href} />
			{/if}
		</div>
	{/if}
</section>
