<script lang="ts">
	export let id: string;
	export let raw = '';
</script>

<textarea
	{id}
	bind:value={raw}
	class="block h-28 w-full rounded border border-dashed border-slate-400 p-2 text-sm"
	placeholder="Dán nội dung từ myBK"
></textarea>
