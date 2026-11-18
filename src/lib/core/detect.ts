import { TableNotFoundError } from './parser/errors';
import { MixedSemesterError } from './resolver';
import type { ExamRow, ParseMetadata, Timerow, Timetable } from './timetable';

export type ScheduleKind = 'exam' | 'sinh viên 2024' | 'sinh viên' | 'giảng viên' | 'sau đại học';

function normalizeHeaderCell(s: string): string {
	return s
		.replace(/\r$/, '')
		.replace(/\u00a0/g, ' ')
		.trim()
		.replace(/\s+/g, ' ')
		.normalize('NFD')
		.toLowerCase();
}

const KIND_HEADERS: ReadonlyArray<{ kind: ScheduleKind; cols: string[] }> = [
	{
		kind: 'exam',
		cols: [
			'học kỳ',
			'môn học',
			'nhóm lớp',
			'ngày thi',
			'loại thi',
			'cơ sở',
			'mã phòng',
			'thứ',
			'giờ bắt đầu',
			'tổng số phút',
			'cập nhật cuối cùng vào lúc'
		].map(normalizeHeaderCell)
	},
	{
		kind: 'sinh viên 2024',
		cols: [
			'học kỳ',
			'mã mh',
			'tên môn học',
			'tín chỉ',
			'tc học phí',
			'nhóm - tổ',
			'thứ',
			'tiết',
			'giờ học',
			'phòng',
			'cơ sở',
			'tuần học'
		].map(normalizeHeaderCell)
	},
	{
		kind: 'sinh viên',
		cols: [
			'mã mh',
			'tên môn học',
			'tín chỉ',
			'tc học phí',
			'nhóm-tổ',
			'thứ',
			'tiết',
			'giờ học',
			'phòng',
			'cơ sở',
			'tuần học'
		].map(normalizeHeaderCell)
	},
	{
		kind: 'giảng viên',
		cols: [
			'lớp',
			'tên mh',
			'phòng',
			'dãy',
			'thứ',
			'số tiết',
			'tiết',
			'giờ',
			'tuần học',
			'% nd'
		].map(normalizeHeaderCell)
	},
	{
		kind: 'sau đại học',
		cols: [
			'cán bộ giảng dạy',
			'môn học',
			'lớp/ds lớp',
			'thứ',
			'tiết bắt đầu',
			'tiết kết thúc',
			'phòng',
			'tuần',
			'ghi chú'
		].map(normalizeHeaderCell)
	}
];

export function detectKind(src: string): ScheduleKind {
	const lines = src.replace(/\r\n?/g, '\n').split('\n');

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];

		if (rawLine.includes('\t')) {
			const tabCells = rawLine.split('\t').map(normalizeHeaderCell);
			for (const { kind, cols } of KIND_HEADERS) {
				if (tabCells.length === cols.length && tabCells.every((cell, idx) => cell === cols[idx])) {
					return kind;
				}
			}
		}

		for (const { kind, cols } of KIND_HEADERS) {
			if (i + cols.length <= lines.length) {
				let matches = true;
				for (let idx = 0; idx < cols.length; idx++) {
					if (normalizeHeaderCell(lines[i + idx]) !== cols[idx]) {
						matches = false;
						break;
					}
				}
				if (matches) {
					return kind;
				}
			}
		}
	}

	throw new TableNotFoundError(src);
}

export function extractMeta(src: string): ParseMetadata {
	const normalized = src
		.replace(/\r\n?/g, '\n')
		.replace(/\u00a0/g, ' ')
		.normalize('NFC');
	const meta: ParseMetadata = {};

	for (const line of normalized.split('\n')) {
		const nameMatch = line.match(
			/^[ \t]*Họ[ \t]+tên[ \t]*:[ \t]*(.+?)(?:[ \t]*\(([^()\n]+?)\))?[ \t]*$/i
		);
		if (nameMatch) {
			const studentName = nameMatch[1].replace(/\s+/g, ' ').trim();
			if (studentName) {
				meta.studentName = studentName;
				if (nameMatch[2]) {
					const studentId = nameMatch[2].replace(/\s+/g, ' ').trim();
					if (studentId) {
						meta.studentId = studentId;
					}
				}
				break;
			}
		}
	}

	const pageMatch = normalized.match(
		/Trình\s+bày\s+từ\s+dòng\s+(\d+)\s+đến\s+(\d+)\s*\/\s*(\d+)\s+dòng/i
	);
	if (pageMatch) {
		const shownFrom = Number(pageMatch[1]);
		const shown = Number(pageMatch[2]);
		const total = Number(pageMatch[3]);
		if (
			Number.isFinite(shownFrom) &&
			Number.isFinite(shown) &&
			Number.isFinite(total) &&
			shown >= 0 &&
			total >= 0
		) {
			meta.pagination = { shownFrom, shown, total };
		}
	}

	return meta;
}

function rowSignature(row: Timerow): string {
	return JSON.stringify([
		row.name,
		Number.isNaN(row.weekday) ? 'NaN' : row.weekday,
		row.startHm,
		row.endHm,
		row.location,
		Object.entries(row.extras).sort(([a], [b]) => a.localeCompare(b)),
		row.weeks
	]);
}

function examSignature(exam: ExamRow): string {
	return JSON.stringify([
		exam.rawCourse,
		exam.group,
		exam.date,
		exam.examType,
		exam.startHm,
		exam.room
	]);
}

type Pagination = NonNullable<ParseMetadata['pagination']>;

function isTruncatedPagination(p: Pagination): boolean {
	return (p.shownFrom ?? 1) > 1 || p.shown < p.total;
}

function mergePaginationGroup(group: Pagination[]): Pagination | undefined {
	if (group.length === 0) return undefined;
	if (group.length === 1) return { ...group[0] };

	const total = group[0].total;
	if (group.every((p) => p.total === total)) {
		if (total === 0) {
			return { shownFrom: group[0].shownFrom ?? 0, shown: 0, total: 0 };
		}
		const intervals: Array<[number, number]> = group
			.map((p): [number, number] => [p.shownFrom ?? 1, p.shown])
			.filter(([start, end]) => start <= end)
			.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

		if (intervals.length === 0) {
			return { ...group[0] };
		}

		const merged: Array<[number, number]> = [intervals[0]];
		for (let i = 1; i < intervals.length; i++) {
			const cur = merged[merged.length - 1];
			const next = intervals[i];
			if (next[0] <= cur[1] + 1) {
				cur[1] = Math.max(cur[1], next[1]);
			} else {
				merged.push(next);
			}
		}

		if (merged.length === 1 && merged[0][0] === 1) {
			return { shownFrom: 1, shown: merged[0][1], total };
		}
		const totalCovered = merged.reduce((sum, [s, e]) => sum + Math.max(0, e - s + 1), 0);
		return { shownFrom: merged[0][0], shown: totalCovered, total };
	}

	return group.find(isTruncatedPagination) ?? { ...group[group.length - 1] };
}

export function mergeTimetables(timetables: Timetable[]): Timetable {
	if (timetables.length === 0) {
		throw new Error('Cannot merge an empty list of timetables');
	}

	const semester = timetables[0].semester;
	let startMondayUTC: Date | undefined;

	const seenRows = new Set<string>();
	const rows: Timerow[] = [];

	const seenExams = new Set<string>();
	const exams: ExamRow[] = [];
	const hasExams = timetables.some((tt) => tt.exams !== undefined);

	let studentName: string | undefined;
	let studentId: string | undefined;
	const classPaginations: Pagination[] = [];
	const examPaginations: Pagination[] = [];

	for (const tt of timetables) {
		if (tt.semester !== semester) {
			throw new Error(
				`Cannot merge timetables from different semesters: ${semester} vs ${tt.semester}`
			);
		}

		if (tt.startMondayUTC) {
			if (!startMondayUTC) {
				startMondayUTC = new Date(+tt.startMondayUTC);
			} else if (+startMondayUTC !== +tt.startMondayUTC) {
				throw new MixedSemesterError(startMondayUTC, tt.startMondayUTC);
			}
		}

		for (const row of tt.rows) {
			const sig = rowSignature(row);
			if (!seenRows.has(sig)) {
				seenRows.add(sig);
				rows.push({
					...row,
					startHm: [...row.startHm],
					endHm: [...row.endHm],
					weeks: [...row.weeks],
					extras: { ...row.extras }
				});
			}
		}

		for (const exam of tt.exams ?? []) {
			const sig = examSignature(exam);
			if (!seenExams.has(sig)) {
				seenExams.add(sig);
				exams.push({
					...exam,
					startHm: [...exam.startHm],
					endHm: [...exam.endHm]
				});
			}
		}

		if (tt.metadata?.studentName && !studentName) {
			studentName = tt.metadata.studentName;
		}
		if (tt.metadata?.studentId && !studentId) {
			studentId = tt.metadata.studentId;
		}
		if (tt.metadata?.pagination) {
			if (tt.exams !== undefined && tt.rows.length === 0) {
				examPaginations.push(tt.metadata.pagination);
			} else {
				classPaginations.push(tt.metadata.pagination);
			}
		}
	}

	const mergedClassPagination = mergePaginationGroup(classPaginations);
	const mergedExamPagination = mergePaginationGroup(examPaginations);
	const pagination =
		mergedClassPagination && isTruncatedPagination(mergedClassPagination)
			? mergedClassPagination
			: mergedExamPagination && isTruncatedPagination(mergedExamPagination)
				? mergedExamPagination
				: (mergedClassPagination ?? mergedExamPagination);

	const result: Timetable = { semester, rows };
	if (startMondayUTC) {
		result.startMondayUTC = startMondayUTC;
	}
	if (hasExams) {
		result.exams = exams;
	}
	if (studentName || studentId || pagination) {
		const metadata: ParseMetadata = {};
		if (studentName) metadata.studentName = studentName;
		if (studentId) metadata.studentId = studentId;
		if (pagination) metadata.pagination = pagination;
		result.metadata = metadata;
	}

	return result;
}
