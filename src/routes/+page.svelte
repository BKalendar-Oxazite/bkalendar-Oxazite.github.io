<script lang="ts">
	import {
		detectKind,
		extractMeta,
		mergeTimetables,
		parseExam2024,
		parseLecturer,
		parsePostgrad,
		parseStudent,
		parseStudent2024,
		resolve,
		type ScheduleKind,
		type Timetable
	} from '$lib/core/mod';
	import { fly } from 'svelte/transition';
	import Key from '$lib/Key.svelte';
	import OkeeButton from '$lib/OkeeButton.svelte';
	import BKalendar from './BKalendar.svelte';
	import ErrorReport from './ErrorReport.svelte';
	import GapiOutputSection from './GapiOutputSection.svelte';
	import IcalOutputSection from './IcalOutputSection.svelte';
	import NameInput from './NameInput.svelte';
	import OutputSelect from './OutputSelect.svelte';
	import PasteArea from './PasteArea.svelte';

	const parsers = {
		exam: parseExam2024,
		'sinh viên 2024': parseStudent2024,
		'sinh viên': parseStudent,
		'giảng viên': parseLecturer,
		'sau đại học': parsePostgrad
	};

	type ParsedPaste = { kind: ScheduleKind; timetable: Timetable };
	type Paste = { raw: string; parsed?: ParsedPaste; error?: Error };
	let pastes: Paste[] = [{ raw: '' }];
	let output: 'ical' | 'gapi' = 'gapi';
	let exported: Timetable | undefined;
	let semester: number | undefined;
	let exportError: Error | undefined;
	let name = '';
	let reminders = [1440, 60];

	function parsePaste(raw: string): Paste {
		if (!raw.trim()) return { raw };
		try {
			const normalized = raw.replace(/\r\n?/g, '\n').normalize('NFC');
			const kind = detectKind(normalized);
			const timetable = parsers[kind](normalized);
			timetable.metadata = { ...timetable.metadata, ...extractMeta(normalized) };
			return { raw, parsed: { kind, timetable } };
		} catch (error) {
			return { raw, error: error as Error };
		}
	}

	function updatePaste(index: number, raw: string) {
		const updated = [...pastes];
		updated[index] = parsePaste(raw);
		const last = updated.findLastIndex((paste) => paste.raw !== '');
		const visible = updated.slice(0, Math.max(1, last + 1));
		if (visible.at(-1)?.parsed) visible.push({ raw: '' });
		pastes = visible;
	}

	function combine(results: Paste[]) {
		const parsed = results.flatMap(({ parsed }) => (parsed ? [parsed] : []));
		if (!parsed.length || results.some(({ error }) => error)) return {};
		try {
			const timetable = mergeTimetables(parsed.map(({ timetable }) => timetable));
			resolve(timetable);
			return { timetable };
		} catch (error) {
			return { error: error as Error };
		}
	}

	$: combined = combine(pastes);
	$: semester = combined.timetable?.semester;
	$: pagination = combined.timetable?.metadata?.pagination;
	$: validSemester = /^\d+[123]$/.test(String(semester));
	$: if (semester !== undefined) exportError = undefined;
	$: pageError = combined.error ?? exportError;

	function next() {
		const timetable = combined.timetable;
		if (!timetable || semester === undefined || !validSemester) return;
		const edited = { ...timetable, semester };
		try {
			if (semester !== timetable.semester) {
				delete edited.startMondayUTC;
				resolve(edited);
			}
			const prefix = !edited.startMondayUTC
				? 'THI'
				: edited.exams?.length
					? 'SV'
					: pastes.some(({ parsed }) => parsed?.kind === 'giảng viên')
						? 'GV'
						: pastes.some(({ parsed }) => parsed?.kind === 'sau đại học')
							? 'SDH'
							: 'SV';
			name = prefix + semester;
			exported = edited;
		} catch (error) {
			exportError = error as Error;
		}
	}
</script>

<svelte:head>
	<title>Nhập lịch | BKalendar x Oxazite</title>
</svelte:head>

<BKalendar />
<p class="text-right"><i>vì bạn xứng đáng có một bộ lịch đẹp 🌹</i></p>
<div class="h-4" />

{#if !exported}
	<div out:fly={{ delay: 500, duration: 500, x: -100 }}>
		<p>
			hãy <Key>Ctrl</Key>
			<Key>A</Key> rồi <Key>Ctrl</Key>
			<Key>V</Key> thời khóa biểu hoặc lịch thi của bạn vào bên dưới, mình sẽ tự trích lịch của bạn ra
			🪄
		</p>
		<div class="h-4" />
		{#each pastes as paste, index}
			{#if index > 0}
				<label for={'schedule-' + index} class="mt-4 block"> Dán thêm trang hoặc lịch thi </label>
			{/if}
			<PasteArea
				id={'schedule-' + index}
				raw={paste.raw}
				onInput={(raw) => updatePaste(index, raw)}
			/>
			{#if index === 0}
				{#if combined.timetable?.metadata?.studentName}
					<p class="mt-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-900">
						{combined.timetable.metadata.studentName}
					</p>
				{/if}
				{#if pagination && ((pagination.shownFrom ?? 1) > 1 || pagination.shown < pagination.total)}
					<p role="status" class="bg-amber-50 text-amber-900 mt-3 rounded p-2 text-sm">
						Đã dán {pagination.shownFrom && pagination.shownFrom > 1
							? pagination.shownFrom + '–'
							: ''}{pagination.shown} / {pagination.total} dòng. Bạn có thể thêm các trang còn lại bên
						dưới.
					</p>
				{/if}
			{/if}
		{/each}
		<div class="h-4" />
		<div class="flex items-center justify-end space-x-4">
			<label for="semester" class="flex-shrink-0">học kỳ</label>
			<input
				id="semester"
				type="number"
				class="inline w-16 outline-dashed outline-[1.5px] outline-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
				disabled={!combined.timetable}
				bind:value={semester}
			/>
		</div>
		<div class="h-4" />
		<div class="flex justify-end">
			<OkeeButton variant="navy" disabled={!combined.timetable || !validSemester} on:click={next} />
		</div>
		{#each pastes as paste}
			{#if paste.error}
				<div class="h-4" />
				<ErrorReport error={paste.error} />
			{/if}
		{/each}
		{#if pageError}
			<div class="h-4" />
			<ErrorReport error={pageError} />
		{/if}
		{#if semester !== undefined && !validSemester}
			<div class="h-4" />
			<ErrorReport error={new Error('mã học kỳ sai định dạng. ví dụ mã đúng: 231, 232, 233.')} />
		{/if}
		<div class="h-4" />
	</div>
{:else}
	<div in:fly={{ delay: 1000, x: 100 }}>
		<NameInput bind:name />
		<div class="h-4" />
		<OutputSelect bind:output />
		<div class="h-4" />
		{#if output === 'gapi'}
			<GapiOutputSection timetable={exported} {name} bind:reminders />
		{:else}
			<IcalOutputSection timetable={exported} {name} bind:reminders />
		{/if}
		<button
			type="button"
			class="mt-4 text-sm text-marine-500 underline"
			on:click={() => (exported = undefined)}
		>
			← sửa nội dung đã dán
		</button>
	</div>
{/if}
