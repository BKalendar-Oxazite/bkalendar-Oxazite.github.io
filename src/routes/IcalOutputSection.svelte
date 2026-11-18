<script lang="ts">
	import H2 from '$lib/H2.svelte';
	import OkeeButton from '$lib/OkeeButton.svelte';
	import { formatGapiSplit, formatIcal, type IcalOptions, type Timetable } from '$lib/core/mod';
	import ExamPreview from './ExamPreview.svelte';
	import GapiPreview from './GapiPreview.svelte';

	export let timetable: Timetable;
	export let name: string;
	export let reminders: number[];

	$: preview = formatGapiSplit(timetable, { examRemindersMinutes: reminders });
	$: fallbackName = (preview.classEvents.length ? 'SV' : 'THI') + timetable.semester;

	function download(scope: NonNullable<IcalOptions['scope']>, filename: string) {
		const text = formatIcal(timetable, { scope, examRemindersMinutes: reminders });
		const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
		const anchor = document.createElement('a');
		const safeName = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
		anchor.href = url;
		anchor.download = safeName + (/\.ics$/i.test(safeName) ? '' : '.ics');
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<H2>📅 xem trước</H2>
{#if preview.classEvents.length}<GapiPreview events={preview.classEvents} />{/if}
{#if timetable.exams?.length}<ExamPreview
		exams={timetable.exams}
		events={preview.examEvents}
	/>{/if}
<div class="mt-4 flex flex-wrap justify-center gap-2">
	<OkeeButton variant="navy" on:click={() => download('all', name.trim() || fallbackName)}>
		↓ Tải .ics
	</OkeeButton>
	{#if preview.classEvents.length && preview.examEvents.length}
		<OkeeButton variant="slate" on:click={() => download('classes', 'SV' + timetable.semester)}>
			TKB (.ics)
		</OkeeButton>
		<OkeeButton variant="slate" on:click={() => download('exams', 'THI' + timetable.semester)}>
			Lịch thi (.ics)
		</OkeeButton>
	{/if}
</div>
<p class="mt-3 text-center text-sm">
	<a
		class="text-marine-500 underline"
		href="https://calendar.google.com/calendar/u/0/r/settings/export"
		target="_blank"
		rel="noopener noreferrer">Mở trang nhập tệp của Lịch Google ↗</a
	>
</p>
