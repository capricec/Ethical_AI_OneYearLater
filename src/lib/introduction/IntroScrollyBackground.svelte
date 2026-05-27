<script>
	import { assetPath } from '$lib/appPaths.js';
	import { INTRO_CHART_IMAGE_CLASS, SURVEY_RESULTS_SRC } from '$lib/introduction/introAssets.js';

	/** @type {{ surveyOpacity?: number, surveyScale?: number }} */
	let { surveyOpacity = 0.15, surveyScale = 0.78 } = $props();
</script>

<div class="pointer-events-none fixed inset-0 z-0 flex items-center justify-center" aria-hidden="true">
	<img
		class="{INTRO_CHART_IMAGE_CLASS} transition-[opacity,transform] duration-700 ease-out will-change-transform"
		src={assetPath(SURVEY_RESULTS_SRC)}
		alt=""
		decoding="async"
		style:opacity={surveyOpacity}
		style:transform="scale({surveyScale})"
	/>
</div>
