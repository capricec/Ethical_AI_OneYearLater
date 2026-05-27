<script>
	import ExperienceQuestionBar from '$lib/components/ExperienceQuestionBar.svelte';
	import SiteHamburgerMenu from '$lib/components/SiteHamburgerMenu.svelte';

	/** @type {{
		topics?: { id: string, label: string }[],
		selectedDebateId?: string | null,
		valueText?: string,
		showValue?: boolean,
		onSelectDebate?: (debateId: string | null) => void,
		onClearValue?: (() => void) | undefined
	}} */
	let {
		topics = [],
		selectedDebateId = null,
		valueText = '',
		showValue = true,
		onSelectDebate,
		onClearValue = undefined
	} = $props();
</script>

<header class="relative z-40 w-full shrink-0 bg-[#4B4B4E] px-3 py-3 md:px-4">
	<div class="flex items-start gap-2 md:items-center md:gap-3">
		<div class="mx-auto flex w-full max-w-[1000px] flex-1">
			<ExperienceQuestionBar {topics} {selectedDebateId} onSelect={onSelectDebate} />
		</div>
		<div class="shrink-0 pl-2">
			<SiteHamburgerMenu lightIcon />
		</div>
	</div>
	{#if showValue && valueText}
		<div class="mt-2 flex min-w-0 items-start gap-2 px-1">
			<p class="min-w-0 flex-1 text-xs font-bold leading-snug text-white md:text-sm">{valueText}</p>
			{#if onClearValue}
				<button
					type="button"
					class="shrink-0 text-base leading-none text-white/60 hover:text-white"
					onclick={onClearValue}
					aria-label="Clear selected statement"
				>
					×
				</button>
			{/if}
		</div>
	{/if}
</header>
