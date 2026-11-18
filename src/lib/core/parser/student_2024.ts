import { ParseError, SemesterNotFoundError, TableNotFoundError } from './errors';
import type { Timerow, Timetable } from '../timetable';
import { extractTableRows, parseTime } from './utils';

const HEADER_COLS = [
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
];

export function parseSemesterCode(raw: string): number | null {
	const trimmed = raw.trim();
	if (!/^\d{3,5}$/.test(trimmed)) {
		return null;
	}
	return Number(trimmed) % 1000;
}

export function isSelectMegaLine(line: string): boolean {
	const normalized = line
		.replace(/\r$/, '')
		.replace(/\u00a0/g, ' ')
		.normalize('NFC')
		.trim();
	if (/Tất cả học k[ìỳ]/i.test(normalized)) {
		return true;
	}
	const matches = normalized.match(/Học kỳ [123] Năm học \d+\s*-\s*\d+/gi);
	return (matches?.length ?? 0) > 1;
}

export function extractSemester2024(
	lines: string[],
	headerIndex: number,
	firstRowSemesterRaw = ''
): number | null {
	const standaloneRe =
		/^(?:\d{5}\s*-\s*)?Học kỳ ([123]) Năm học (\d+)\s*-\s*(\d+)(?:\s*\(Hiện hành\))?$/i;
	const currentRe = /Học kỳ ([123]) Năm học (\d+)\s*-\s*(\d+)\s*\(Hiện hành\)/i;
	const genericRe = /Học kỳ ([123]) Năm học (\d+)\s*-\s*(\d+)/i;

	const scan = (re: RegExp, allowMegaLine: boolean): number | null => {
		for (let j = 1; j <= 8; j++) {
			const idx = headerIndex - j;
			if (idx < 0) break;
			const line = lines[idx]
				.replace(/\r$/, '')
				.replace(/\u00a0/g, ' ')
				.normalize('NFC')
				.trim();
			if (!allowMegaLine && isSelectMegaLine(line)) {
				continue;
			}
			const m = line.match(re);
			if (m) {
				return (Number(m[2]) % 100) * 10 + Number(m[1]);
			}
		}
		return null;
	};

	return (
		scan(standaloneRe, false) ??
		scan(genericRe, false) ??
		parseSemesterCode(firstRowSemesterRaw) ??
		scan(currentRe, true)
	);
}

export function parseStudent2024(src: string): Timetable {
	const trimmed = src.trim();
	const lines = trimmed.split(/\r?\n/);
	const extracted = extractTableRows(lines, HEADER_COLS);
	if (!extracted) {
		throw new TableNotFoundError(trimmed);
	}

	const semester = extractSemester2024(lines, extracted.headerIndex, extracted.rows[0]?.[0] ?? '');
	if (semester === null) {
		throw new SemesterNotFoundError(
			lines.slice(Math.max(0, extracted.headerIndex - 8), extracted.headerIndex).join('\n') ||
				trimmed
		);
	}

	const rows: Timerow[] = [];
	for (const rawCols of extracted.rows) {
		const cols = rawCols.map((c) => c.normalize('NFC'));
		const timeStr = cols[8].trim();
		if (timeStr === '' || timeStr === '--' || timeStr === '---' || timeStr === '- - -') {
			continue;
		}

		const weekdayStr = cols[6].trim();
		const weekday = weekdayStr === 'CN' ? 8 : weekdayStr === '' ? NaN : Number(weekdayStr);

		const times = timeStr.split(' - ');
		if (times.length !== 2) {
			throw new ParseError(cols[8], 'Time column is not separated by " - "');
		}
		const startHm = parseTime(times[0]);
		const endHm = parseTime(times[1]);

		const weeks = cols[11]
			.replace(/\|$/, '')
			.split('|')
			.map((s) => (s === '--' || s === '' ? null : Number(s)));

		rows.push({
			name: cols[2],
			weekday,
			startHm,
			endHm,
			weeks,
			location: cols[9],
			extras: {
				'mã môn học': cols[1],
				'tín chỉ': cols[3],
				'tín chỉ học phí': cols[4],
				'nhóm tổ': cols[5]
			}
		});
	}

	return { semester, rows };
}
