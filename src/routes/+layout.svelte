<script lang="ts">
	import '../app.postcss';
	import '@fontsource/arimo';
</script>

<div class="mx-auto max-w-xs px-4 py-10 font-body sm:px-0 sm:py-20">
	<main><slot /></main>
	<footer
		class="mt-10 flex justify-between gap-3 border-t border-slate-200 pt-3 text-sm text-slate-600"
	>
		<span>Oxazite edition</span>
		<a class="underline" href="/privacy">Quyền riêng tư</a>
	</footer>
</div>

<style>
	:global(body) {
		overflow-y: scroll;
	}
</style>
