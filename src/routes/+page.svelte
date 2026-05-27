<script>
	import IntroEnterToolCta from '$lib/introduction/IntroEnterToolCta.svelte';
	import IntroductionScrolly from '$lib/introduction/IntroductionScrolly.svelte';
</script>

<svelte:head>
	<title>Everyday Ethics of AI</title>
</svelte:head>

<div class="relative h-[100dvh] w-full overflow-hidden bg-[#333333] text-white">
	<div class="fixed top-0 right-0 z-50 p-4 md:p-5">
		<IntroEnterToolCta label="Explore the Data" outlinePill />
	</div>
	<IntroductionScrolly />
</div>
