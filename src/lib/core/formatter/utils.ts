import { ASIA_HO_CHI_MINH, DAY, HOUR, MINUTE, WEEK } from '../constants';
import type { ExamRow } from '../timetable';

export { ASIA_HO_CHI_MINH };

const utcFormatter = new Intl.DateTimeFormat('vi-VN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
	hourCycle: 'h23',
	timeZone: 'UTC'
});

const hcmFormatter = new Intl.DateTimeFormat('vi-VN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
	hourCycle: 'h23',
	timeZone: ASIA_HO_CHI_MINH
});

export function dateOfIndex(
	i: number,
	hm: [number, number],
	startMondayUTC: Date,
	weekday: number
): Date {
	// hm is in GMT+7
	return new Date(
		+startMondayUTC + i * WEEK + (weekday - 2) * DAY + (hm[0] - 7) * HOUR + hm[1] * MINUTE
	);
}

export function hcmDateToUtc(dateYmd: string, hm: [number, number]): Date {
	const match = dateYmd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		throw new Error(`Invalid YYYY-MM-DD date: ${dateYmd}`);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return new Date(Date.UTC(year, month - 1, day, hm[0] - 7, hm[1], 0, 0));
}

export function examEndDateUtc(exam: ExamRow): Date {
	const startUtc = hcmDateToUtc(exam.date, exam.startHm);
	if (Number.isFinite(exam.durationMinutes) && exam.durationMinutes > 0) {
		return new Date(+startUtc + exam.durationMinutes * MINUTE);
	}
	return hcmDateToUtc(exam.date, exam.endHm);
}

function extractParts(
	formatter: Intl.DateTimeFormat,
	d: Date
): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
	const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
	for (const part of formatter.formatToParts(d)) {
		parts[part.type] = part.value;
	}
	return parts;
}

/**
 * RFC5545 compliant utc datetime
 *
 * see: https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.5
 */
export function formatUTC(d: Date): string {
	const parts = extractParts(utcFormatter, d);
	return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}Z`;
}

/**
 * RFC5545 compliant floating datetime
 *
 * see: https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.5
 */
export function formatHCM(d: Date): string {
	const parts = extractParts(hcmFormatter, d);
	return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

export function formatHCMRfc3339(d: Date): string {
	const parts = extractParts(hcmFormatter, d);
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`;
}

function isBlankExamField(value: string): boolean {
	const trimmed = value.trim();
	return trimmed === '' || /^(?:-\s*){2,}$/.test(trimmed);
}

export function formatExamLocation(exam: ExamRow): string {
	const room = isBlankExamField(exam.room) ? '' : exam.room.trim();
	const campus = isBlankExamField(exam.campus) ? '' : exam.campus.trim();
	if (room && campus) {
		return `${room} (${campus})`;
	}
	return room || campus;
}

export function formatExamSummary(exam: ExamRow): string {
	return `[${exam.examType}] ${exam.rawCourse}`;
}

export function formatExamDescription(exam: ExamRow): string {
	const lines = [`Loại thi: ${exam.examType}`];
	if (!isBlankExamField(exam.group)) {
		lines.push(`Nhóm lớp: ${exam.group.trim()}`);
	}
	if (Number.isFinite(exam.durationMinutes) && exam.durationMinutes > 0) {
		lines.push(`Thời lượng: ${exam.durationMinutes} phút`);
	}
	if (!isBlankExamField(exam.room)) {
		lines.push(`Phòng: ${exam.room.trim()}`);
	}
	if (!isBlankExamField(exam.campus)) {
		lines.push(`Cơ sở: ${exam.campus.trim()}`);
	}
	if (!isBlankExamField(exam.updatedAt)) {
		lines.push(`Cập nhật: ${exam.updatedAt.trim()}`);
	}
	return lines.join('\n');
}
