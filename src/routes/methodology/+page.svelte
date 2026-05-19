<script>
	import IntroBackground from '$lib/introduction/IntroBackground.svelte';
	import IntroRadialMotif from '$lib/introduction/IntroRadialMotif.svelte';
	import IntroSiteMenu from '$lib/introduction/IntroSiteMenu.svelte';
	import { INTRO_BACKGROUND_SRC } from '$lib/introduction/introductionSlides.js';
	import {
		METHODOLOGY_OPENING,
		METHODOLOGY_PARAGRAPHS,
		WORLD_VALUES_SURVEY_URL
	} from '$lib/methodology/methodologyContent.js';

	const proseClass =
		'text-base font-normal leading-relaxed text-white/95 md:text-lg';
</script>

<svelte:head>
	<title>Methodology — Everyday Ethics of AI</title>
</svelte:head>

<div class="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#333333] text-white">
	<div class="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
		<IntroBackground src={INTRO_BACKGROUND_SRC} />
	</div>
	{#if !INTRO_BACKGROUND_SRC}
		<IntroRadialMotif />
	{/if}
	<IntroSiteMenu />

	<main class="relative z-10">
		<section
			class="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16 md:px-10"
			aria-labelledby="methodology-heading"
		>
			<h1
				id="methodology-heading"
				class="max-w-3xl text-center text-2xl font-bold leading-tight text-white md:text-4xl"
			>
				Methodology
			</h1>
		</section>

		<section
			class="mx-auto flex max-w-xl flex-col gap-6 px-6 pb-24 pt-4 text-center md:max-w-2xl md:gap-8 md:px-10 md:pb-32"
			aria-label="Methodology"
		>
			<p class={proseClass}>{METHODOLOGY_OPENING}</p>

			<p class={proseClass}>
				First, how do you measure ethics? For this, I decided to lean on the research of the World
				Values Survey, an international research program devoted to the scientific and academic study
				of social, political, economic, religious and cultural values of people in the world. You can
				find more about the World Values Survey
				<a
					href={WORLD_VALUES_SURVEY_URL}
					class="font-normal text-white underline decoration-white/70 underline-offset-2 hover:decoration-white"
					target="_blank"
					rel="noopener noreferrer"
				>here</a>.
			</p>

			{#each METHODOLOGY_PARAGRAPHS as paragraph, i (i)}
				<p class={proseClass}>{paragraph}</p>
			{/each}
		</section>
	</main>
</div>
