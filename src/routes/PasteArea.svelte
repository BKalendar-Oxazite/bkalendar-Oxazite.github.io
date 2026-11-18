<script lang="ts">
	export let id: string;
	export let raw = '';
	export let onInput: (raw: string) => void;
</script>

<textarea
	{id}
	value={raw}
	on:input={(event) => onInput(event.currentTarget.value)}
	class="block h-28 w-full rounded border border-dashed border-slate-400 p-2 text-sm"
	placeholder="Dán nội dung từ myBK"
></textarea>
