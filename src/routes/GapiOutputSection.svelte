<script lang="ts">
	import { onMount } from 'svelte';
	import H2 from '$lib/H2.svelte';
	import OkeeButton from '$lib/OkeeButton.svelte';
	import RadioButton from '$lib/RadioButton.svelte';
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
<fieldset disabled={busy || !!calendarId}>
	<legend>bạn là người chơi hệ:</legend>
	<div class="mt-4 flex justify-around text-base">
		<RadioButton bind:group={mode} value="mono" variant="slate">🗿 tối giản</RadioButton>
		<RadioButton bind:group={mode} value="random" variant="rose">💅 bảy sắc cầu vồng</RadioButton>
	</div>
</fieldset>

<H2>😎 xem trước</H2>
<p>cái lịch sẽ nhìn giống giống thế này:</p>
{#if classEvents.length}
	<GapiPreview events={classEvents} />
{/if}
{#if timetable.exams?.length}
	<ExamPreview exams={timetable.exams} events={examEvents} bind:reminders />
{/if}

<div class="h-4" />
<div class="flex justify-center">
	{#if mode === 'random' && !calendarId}
		<OkeeButton disabled={busy} variant="slate" on:click={() => shuffle(events.length)}>
			🎲 màu khác ik
		</OkeeButton>
		<div class="w-4" />
	{/if}
	{#if !ready && !preparing}
		<OkeeButton variant="navy" on:click={prepare}>Thử tải lại Lịch Google</OkeeButton>
	{:else}
		<OkeeButton
			disabled={!ready || busy || complete || !name.trim()}
			variant="navy"
			on:click={addCalendar}
		>
			{busy ? '🏃‍♂️ đang thêm...' : calendarId && !complete ? 'Thử lại' : '👌 okee'}
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

<details class="mt-4 text-sm">
	<summary class="cursor-pointer">tùy chọn màu</summary>
	<fieldset
		class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2"
		disabled={busy || !!calendarId}
	>
		<label class="flex items-center gap-2">
			<input type="radio" bind:group={mode} value="by-course" /> 🎨 theo môn học
		</label>
		{#if examEvents.length}
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={examHighlight} /> 🔴 tô đỏ lịch thi
			</label>
		{/if}
	</fieldset>
</details>
