<script>
	import IntroScrollyBackground from '$lib/introduction/IntroScrollyBackground.svelte';
	import IntroSiteMenu from '$lib/introduction/IntroSiteMenu.svelte';
	import {
		SURVEY_BG_OPACITY_PRE_SURVEY,
		SURVEY_BG_SCALE_PRE_SURVEY
	} from '$lib/introduction/introAssets.js';
	import {
		METHODOLOGY_OPENING,
		METHODOLOGY_SECTIONS,
		WORLD_VALUES_SURVEY_URL
	} from '$lib/methodology/methodologyContent.js';

	const proseClass =
		'text-base font-normal leading-relaxed text-white/95 md:text-lg';
	const sectionTitleClass =
		'text-xl font-bold leading-tight text-white md:text-2xl';
</script>

<svelte:head>
	<title>Everyday Ethics of AI</title>
</svelte:head>

<div class="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#333333] text-white">
	<IntroScrollyBackground
		surveyOpacity={SURVEY_BG_OPACITY_PRE_SURVEY}
		surveyScale={SURVEY_BG_SCALE_PRE_SURVEY}
	/>
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
			class="mx-auto flex max-w-xl flex-col gap-12 px-6 pb-24 pt-4 text-center md:max-w-3xl md:gap-14 md:px-10 md:pb-32"
			aria-label="Methodology"
		>
			<p class={proseClass}>{METHODOLOGY_OPENING}</p>

			{#each METHODOLOGY_SECTIONS as section (section.id)}
				<article class="flex flex-col gap-4 md:gap-5" aria-labelledby="methodology-{section.id}">
					<h2 id="methodology-{section.id}" class={sectionTitleClass}>
						{section.title}
					</h2>

					{#if section.includeWorldValuesLink}
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
					{/if}

					{#each section.paragraphs as paragraph, i (`${section.id}-${i}`)}
						<p class={proseClass}>{paragraph}</p>
					{/each}
				</article>
			{/each}
		</section>
	</main>
</div>
