<script lang="ts">
	import { onMount } from 'svelte';
	import H2 from '$lib/H2.svelte';
	import OkeeButton from '$lib/OkeeButton.svelte';
	import {
		courseColorIds,
		EXAM_TOMATO_COLOR_ID,
		randomColorIds,
		type ColorMode
	} from '$lib/colors';
	import { formatGapiSplit, type GapiEvent, type Timetable } from '$lib/core/mod';
	import {
		authorizeGoogle,
		createCalendar,
		googleErrorMessage,
		insertEvent,
		prepareGoogle
	} from '$lib/google';
	import ExamPreview from './ExamPreview.svelte';
	import GapiPreview from './GapiPreview.svelte';

	export let timetable: Timetable;
	export let name: string;
	export let reminders: number[];

	const modes: { value: ColorMode; label: string }[] = [
		{ value: 'mono', label: '⚪ tối giản' },
		{ value: 'random', label: '🌈 bảy sắc cầu vồng' },
		{ value: 'by-course', label: '🎨 theo môn học' }
	];
	let mode: ColorMode = 'random';
	let examHighlight = false;
	let ready = false;
	let preparing = false;
	let busy = false;
	let error = '';
	let calendarId = '';
	let inserted = 0;
	let upload: { event: GapiEvent; id: string }[] = [];
	let complete = false;
	let randomColors: string[] = [];

	$: split = formatGapiSplit(timetable, { examRemindersMinutes: reminders });
	$: events = [...split.classEvents, ...split.examEvents];
	$: shuffle(events.length);
	$: colors = mode === 'random' ? randomColors : mode === 'by-course' ? courseColorIds(events) : [];
	$: classEvents = split.classEvents.map((event, index) => ({ ...event, colorId: colors[index] }));
	$: examEvents = split.examEvents.map((event, index) => ({
		...event,
		colorId: examHighlight ? EXAM_TOMATO_COLOR_ID : colors[split.classEvents.length + index]
	}));

	function shuffle(count: number) {
		randomColors = [...randomColorIds(count)];
	}

	async function prepare() {
		preparing = true;
		error = '';
		try {
			await prepareGoogle();
			ready = true;
		} catch (failure) {
			error = googleErrorMessage(failure);
		} finally {
			preparing = false;
		}
	}

	onMount(() => {
		void prepare();
	});

	async function addCalendar() {
		if (!ready || busy || complete || !name.trim()) return;
		busy = true;
		error = '';
		try {
			await authorizeGoogle();
			if (!calendarId) {
				upload = [...classEvents, ...examEvents].map((event) => ({
					event,
					id: crypto.randomUUID().replace(/-/g, '')
				}));
				calendarId = await createCalendar(name.trim());
			}
			for (; inserted < upload.length; inserted++) {
				const { event, id } = upload[inserted];
				await insertEvent(calendarId, event, id);
			}
			complete = true;
		} catch (failure) {
			error = googleErrorMessage(failure);
		} finally {
			busy = false;
		}
	}
</script>

<H2>🎨 màu sắc</H2>
<fieldset class="mt-2 grid gap-1.5" disabled={busy || !!calendarId}>
	<legend class="text-sm text-slate-700">bạn là người chơi hệ</legend>
	{#each modes as option (option.value)}
		<label class="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm">
			<input type="radio" bind:group={mode} value={option.value} />
			{option.label}
		</label>
	{/each}
	{#if examEvents.length}
		<label class="flex items-center gap-2 px-2 py-1 text-sm">
			<input type="checkbox" bind:checked={examHighlight} /> 🔴 tô đỏ lịch thi
		</label>
	{/if}
</fieldset>

{#if classEvents.length}
	<H2>📅 xem trước</H2>
	<GapiPreview events={classEvents} />
{/if}
{#if timetable.exams?.length}
	<ExamPreview exams={timetable.exams} events={examEvents} />
{/if}

<div class="mt-4 flex flex-wrap justify-center gap-2">
	{#if mode === 'random' && !calendarId}
		<OkeeButton disabled={busy} variant="slate" on:click={() => shuffle(events.length)}>
			🎲 màu khác ik
		</OkeeButton>
	{/if}
	{#if !ready && !preparing}
		<OkeeButton variant="navy" on:click={prepare}>Thử tải lại Lịch Google</OkeeButton>
	{:else}
		<OkeeButton
			disabled={!ready || busy || complete || !name.trim()}
			variant="navy"
			on:click={addCalendar}
		>
			{preparing
				? 'Đang tải Lịch Google…'
				: busy
					? 'Đang thêm…'
					: calendarId && !complete
						? 'Thử lại'
						: '📆 okee'}
		</OkeeButton>
	{/if}
</div>
{#if complete}
	<p class="text-emerald-800 mt-3 text-center text-sm" role="status">
		Đã thêm {inserted} sự kiện vào Lịch Google.
	</p>
{:else if error}
	<p class="bg-rose-50 text-rose-800 mt-3 rounded p-2 text-sm" role="alert">
		{error}
		{#if calendarId}Đã thêm {inserted} / {upload.length} sự kiện vào lịch mới.{/if}
	</p>
{/if}
