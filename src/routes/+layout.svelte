<script lang="ts">
	import '../app.postcss';
	import '@fontsource/arimo';
</script>

<div class="mx-auto max-w-xs py-20 font-body">
	<main><slot /></main>
	<footer
		class="mt-10 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-slate-200 pt-3 text-sm text-slate-600"
	>
		<span>Oxazite edition</span>
		<a class="underline" href="https://bkalendar.github.io/">BKalendar gốc</a>
		<a class="underline" href="/privacy">Quyền riêng tư</a>
	</footer>
</div>

<style>
	:global(body) {
		overflow-y: scroll;
	}
</style>
