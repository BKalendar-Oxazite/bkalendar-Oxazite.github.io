import { ParseError, SemesterNotFoundError, TableNotFoundError } from './errors';
import type { ExamRow, Timetable } from '../timetable';
import { extractSemester2024, parseSemesterCode } from './student_2024';
import { addMinutesToHm, extractTableRows, parseExamTime } from './utils';

const HEADER_COLS = [
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
];

export function parseExam2024(src: string): Timetable {
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

	const exams: ExamRow[] = [];
	for (const rawCols of extracted.rows) {
		const cols = rawCols.map((c) => c.normalize('NFC'));
		const rowSemester = parseSemesterCode(cols[0]) ?? semester;

		const rawCourse = cols[1].trim();
		const sepIdx = rawCourse.indexOf(' - ');
		const courseCode = sepIdx !== -1 ? rawCourse.slice(0, sepIdx).trim() : rawCourse;
		const courseName = sepIdx !== -1 ? rawCourse.slice(sepIdx + 3).trim() : rawCourse;

		const date = cols[3].trim();
		const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!dateMatch) {
			throw new ParseError(cols[3], 'Invalid exam date format, expected YYYY-MM-DD');
		}
		const year = Number(dateMatch[1]);
		const month = Number(dateMatch[2]);
		const day = Number(dateMatch[3]);
		const checkDate = new Date(Date.UTC(year, month - 1, day));
		if (
			checkDate.getUTCFullYear() !== year ||
			checkDate.getUTCMonth() !== month - 1 ||
			checkDate.getUTCDate() !== day
		) {
			throw new ParseError(cols[3], `Invalid exam calendar date: ${cols[3]}`);
		}

		const weekdayStr = cols[7].trim();
		const weekday = weekdayStr === 'CN' ? 8 : weekdayStr === '' ? NaN : Number(weekdayStr);
		if (!Number.isInteger(weekday) || weekday < 2 || weekday > 8) {
			throw new ParseError(cols[7], `Cannot parse exam weekday: ${cols[7]}`);
		}

		const startHm = parseExamTime(cols[8]);
		const durationStr = cols[9].trim();
		const durationMinutes = durationStr === '' ? NaN : Number(durationStr);
		if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
			throw new ParseError(cols[9], `Invalid exam duration minutes: ${cols[9]}`);
		}
		const endHm = addMinutesToHm(startHm, durationMinutes);

		exams.push({
			semester: rowSemester,
			courseCode,
			courseName,
			rawCourse,
			group: cols[2].trim(),
			date,
			examType: cols[4].trim(),
			campus: cols[5].trim(),
			room: cols[6].trim(),
			weekday,
			startHm,
			endHm,
			durationMinutes,
			updatedAt: cols[10].trim()
		});
	}

	return { semester, rows: [], exams };
}
