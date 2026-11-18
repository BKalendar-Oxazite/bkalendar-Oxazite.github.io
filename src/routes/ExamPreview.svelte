<script lang="ts">
	import {
		ASIA_HO_CHI_MINH,
		formatGoogleCalendarTemplateUrl,
		type ExamRow,
		type GapiEvent
	} from '$lib/core/mod';
	import { eventColor } from '$lib/colors';
	import H2 from '$lib/H2.svelte';

	export let exams: ExamRow[];
	export let events: GapiEvent[];
	export let reminders: number[];

	const date = new Intl.DateTimeFormat('vi-VN', {
		timeZone: ASIA_HO_CHI_MINH,
		weekday: 'long',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	const time = new Intl.DateTimeFormat('vi-VN', {
		timeZone: ASIA_HO_CHI_MINH,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});
	$: cards = exams
		.map((exam, index) => ({ exam, event: events[index] }))
		.sort((a, b) => a.event.start.dateTime.localeCompare(b.event.start.dateTime));
</script>

<H2>Lịch thi ({cards.length})</H2>
<label class="flex items-start gap-2 text-sm">
	<input
		type="checkbox"
		class="mt-1"
		checked={reminders.length > 0}
		on:change={(event) => (reminders = event.currentTarget.checked ? [1440, 60] : [])}
	/>
	Nhắc lịch thi trước 1 ngày và 60 phút
</label>
<ul class="mt-3 space-y-2">
	{#each cards as { exam, event }}
		<li
			class="rounded border border-l-4 border-slate-200 px-2.5 py-2 text-sm"
			style:border-left-color={eventColor(event)}
		>
			<p class="font-bold">
				<span class="mr-1 rounded bg-slate-100 px-1 text-xs">{exam.examType}</span>
				{exam.rawCourse}
			</p>
			<p class="capitalize text-slate-700">{date.format(new Date(event.start.dateTime))}</p>
			<p class="text-slate-700">
				{time.format(new Date(event.start.dateTime))} – {time.format(new Date(event.end.dateTime))}
			</p>
			<div class="flex flex-wrap items-baseline justify-between gap-x-2">
				<span>{event.location}</span>
				<a
					href={formatGoogleCalendarTemplateUrl(exam)}
					target="_blank"
					rel="noopener noreferrer"
					class="text-marine-500 underline"
					aria-label={'Thêm ' + event.summary + ' vào Lịch Google'}>＋ GCal</a
				>
			</div>
		</li>
	{/each}
</ul>
