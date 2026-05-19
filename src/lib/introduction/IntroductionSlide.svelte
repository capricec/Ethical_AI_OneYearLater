<script>
	import IntroEnterToolCta from '$lib/introduction/IntroEnterToolCta.svelte';
	import { MODEL_ORDER, modelColor } from '$lib/viz/modelColors.js';

	/** @type {import('./introductionSlides.js').IntroSlide} */
	let { slide } = $props();

	const proseClass = 'text-base font-normal leading-relaxed text-white/95 md:text-lg';

	/** Question pill fill on the questions slide. */
	const questionPillClass =
		'whitespace-nowrap rounded-full bg-[#212121] px-5 py-3.5 text-left text-xs leading-none text-white shadow-sm md:px-6 md:py-4 md:text-sm';

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
</script>

<section
	class="intro-slide relative z-10 flex min-h-[100dvh] w-full snap-start snap-always flex-col items-center justify-center px-6 py-16 md:px-10"
	class:!px-0={slide.type === 'questions'}
	class:!py-0={slide.type === 'questions'}
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
		<div class="flex max-w-3xl flex-col items-center gap-7 text-center">
			<h2
				id="intro-{slide.id}-heading"
				class="text-2xl font-bold text-white md:text-3xl"
			>
				{slide.title}
			</h2>
			<div class="flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
				{#each MODEL_ORDER as model (model)}
					<span
						class="rounded-full px-3 py-1.5 text-sm font-semibold text-white"
						style:background-color={modelColor(model)}
					>
						{model}
					</span>
				{/each}
			</div>
		</div>
	{:else if slide.type === 'questions'}
		<div class="relative h-[100dvh] w-full overflow-visible">
			<h2
				id="intro-{slide.id}-heading"
				class="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center text-2xl font-bold text-white md:text-3xl"
			>
				{slide.title}
			</h2>
			{#each questionPlacements as placement, i (i)}
				<p
					class="absolute z-20 {questionPillClass}"
					style={placementStyle(placement)}
				>
					{placement.text}
				</p>
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
