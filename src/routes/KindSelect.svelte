<script context="module" lang="ts">
	import type { ScheduleKind } from '$lib/core/mod';

	export const labels: Record<ScheduleKind, string> = {
		exam: 'Lịch kiểm tra – thi (myBK)',
		'sinh viên 2024': 'Thời khóa biểu sinh viên (myBK 2024)',
		'sinh viên': 'Thời khóa biểu sinh viên (cũ)',
		'giảng viên': 'Thời khóa biểu giảng viên',
		'sau đại học': 'Thời khóa biểu sau đại học'
	};
</script>

<script lang="ts">
	export let choice: ScheduleKind | 'auto' = 'auto';
</script>

<label class="flex items-center gap-2 text-sm">
	Loại lịch
	<select bind:value={choice} class="min-w-0 flex-1 rounded border border-slate-300 p-1">
		<option value="auto">Tự động</option>
		{#each Object.entries(labels) as [kind, label]}
			<option value={kind}>{label}</option>
		{/each}
	</select>
</label>
