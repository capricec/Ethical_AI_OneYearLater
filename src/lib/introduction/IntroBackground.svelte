<script>
	/** @type {{ src?: string | null, fallbackColor?: string, imageOpacity?: number }} */
	let {
		src = null,
		fallbackColor = '#333333',
		imageOpacity = 1
	} = $props();
</script>

<div
	class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
	style:background-color={fallbackColor}
	aria-hidden="true"
>
	{#if src}
		<img
			class="h-auto w-auto max-h-[min(80vh,800px)] max-w-[min(80vh,800px)] object-contain transition-opacity duration-700 ease-out"
			{src}
			alt=""
			decoding="async"
			fetchpriority="high"
			style:opacity={imageOpacity}
		/>
	{/if}
</div>
