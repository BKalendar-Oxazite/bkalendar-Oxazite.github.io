<script lang="ts">
	export let id: string;
	export let raw = '';
	export let onInput: (raw: string) => void;
</script>

<textarea
	{id}
	value={raw}
	on:input={(event) => onInput(event.currentTarget.value)}
	aria-label={id === 'schedule-0' ? 'Nội dung' : 'Dán thêm trang hoặc lịch thi'}
	placeholder="📋 dán vào đây"
	class="mt-5 h-32 w-full rounded bg-transparent p-2 text-xs placeholder-slate-400 outline-dashed outline-[1.5px] outline-slate-200 placeholder:text-center placeholder:text-base placeholder:font-light placeholder:leading-[7rem] focus:outline-slate-500"
></textarea>
