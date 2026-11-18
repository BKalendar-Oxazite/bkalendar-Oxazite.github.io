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
	import Key from '$lib/Key.svelte';
	import OkeeButton from '$lib/OkeeButton.svelte';
	import BKalendar from './BKalendar.svelte';
	import ErrorReport from './ErrorReport.svelte';
	import GapiOutputSection from './GapiOutputSection.svelte';
	import IcalOutputSection from './IcalOutputSection.svelte';
	import KindSelect, { labels } from './KindSelect.svelte';
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

	type Paste = { raw: string; choice: ScheduleKind | 'auto' };
	type ParsedPaste = { kind: ScheduleKind; timetable: Timetable };
	const blankPaste = (): Paste => ({ raw: '', choice: 'auto' });
	let pastes: Paste[] = [blankPaste()];
	let output: 'ical' | 'gapi' = 'gapi';
	let exported: Timetable | undefined;
	let semester: number | undefined;
	let exportError: Error | undefined;
	let name = '';
	let examReminders = true;

	function parsePaste(paste: Paste): { parsed?: ParsedPaste; error?: Error } {
		if (!paste.raw.trim()) return {};
		try {
			const raw = paste.raw.replace(/\r\n?/g, '\n').normalize('NFC');
			const kind = paste.choice === 'auto' ? detectKind(raw) : paste.choice;
			const timetable = parsers[kind](raw);
			timetable.metadata = { ...timetable.metadata, ...extractMeta(raw) };
			return { parsed: { kind, timetable } };
		} catch (error) {
			return { error: error as Error };
		}
	}

	function combine(results: ReturnType<typeof parsePaste>[]) {
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

	$: results = pastes.map(parsePaste);
	$: combined = combine(results);
	$: semester = combined.timetable?.semester;
	$: pagination = combined.timetable?.metadata?.pagination;
	$: validSemester = /^\d{2}[123]$/.test(String(semester));
	$: if (semester !== undefined) exportError = undefined;
	$: reminders = examReminders ? [1440, 60] : [];

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
					: results.some(({ parsed }) => parsed?.kind === 'giảng viên')
						? 'GV'
						: results.some(({ parsed }) => parsed?.kind === 'sau đại học')
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
<p class="mb-5 text-right"><i>vì bạn xứng đáng có một bộ lịch đẹp 🥰</i></p>

{#if !exported}
	<p>
		Hãy <Key>Ctrl</Key>
		<Key>A</Key>, <Key>Ctrl</Key>
		<Key>C</Key> trên myBK rồi
		<Key>Ctrl</Key>
		<Key>V</Key> lịch học hoặc lịch thi vào bên dưới.
	</p>

	{#each pastes as paste, index (paste)}
		{@const result = results[index]}
		<div class="mt-4 space-y-2">
			<div class="flex items-center justify-between gap-2">
				<label for={'schedule-' + index} class="font-bold">Nội dung {index + 1}</label>
				{#if pastes.length > 1}
					<button
						type="button"
						class="text-sm text-rose-700 underline"
						aria-label={'Xóa nội dung ' + (index + 1)}
						on:click={() => (pastes = pastes.filter((item) => item !== paste))}>Xóa</button
					>
				{/if}
			</div>
			<PasteArea id={'schedule-' + index} bind:raw={paste.raw} />
			<KindSelect bind:choice={paste.choice} />
			{#if result?.parsed && paste.choice === 'auto'}
				<p class="text-sm text-slate-600">{labels[result.parsed.kind]}</p>
			{/if}
			{#if result?.error}<ErrorReport error={result.error} />{/if}
		</div>
	{/each}

	{#if combined.timetable?.metadata?.studentName}
		<p class="mt-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-900">
			{combined.timetable.metadata.studentName}
		</p>
	{/if}
	{#if pagination && ((pagination.shownFrom ?? 1) > 1 || pagination.shown < pagination.total)}
		<p role="status" class="bg-amber-50 text-amber-900 mt-3 rounded p-2 text-sm">
			Đã dán {pagination.shownFrom && pagination.shownFrom > 1
				? pagination.shownFrom + '–'
				: ''}{pagination.shown} / {pagination.total} dòng. Bạn có thể thêm các trang còn lại bên dưới.
		</p>
	{/if}
	{#if combined.error}<ErrorReport error={combined.error} />{/if}
	{#if exportError}<ErrorReport error={exportError} />{/if}

	<button
		type="button"
		class="mt-4 rounded border border-slate-300 px-3 py-1 text-sm text-marine-500"
		on:click={() => (pastes = [...pastes, blankPaste()])}>＋ thêm trang / lịch thi</button
	>
	<div class="mt-4 flex items-center justify-end gap-3">
		<label for="semester">học kỳ</label>
		<input
			id="semester"
			type="number"
			bind:value={semester}
			disabled={!combined.timetable}
			class="w-20 rounded border border-dashed border-slate-400 p-1 disabled:bg-slate-100"
		/>
		<OkeeButton variant="navy" disabled={!combined.timetable || !validSemester} on:click={next} />
	</div>
	{#if combined.timetable && !validSemester}
		<p class="mt-2 text-sm text-rose-700">Mã học kỳ có ba chữ số, ví dụ 261, 262 hoặc 263.</p>
	{/if}
{:else}
	<button
		type="button"
		class="mb-4 text-sm text-marine-500 underline"
		on:click={() => (exported = undefined)}
	>
		← sửa nội dung đã dán
	</button>
	<NameInput bind:name />
	<div class="mt-4"><OutputSelect bind:output /></div>
	{#if exported.exams?.length}
		<label class="mt-4 flex items-start gap-2 text-sm">
			<input type="checkbox" class="mt-1" bind:checked={examReminders} />
			Nhắc lịch thi trước 1 ngày và 60 phút
		</label>
	{/if}
	{#if output === 'gapi'}
		<GapiOutputSection timetable={exported} {name} {reminders} />
	{:else}
		<IcalOutputSection timetable={exported} {name} {reminders} />
	{/if}
{/if}
