import { ASIA_HO_CHI_MINH } from '../constants';
import { isUnresolvable } from '../resolver';
import type { ExamRow, Timerow, Timetable } from '../timetable';
import {
	dateOfIndex,
	examEndDateUtc,
	formatExamDescription,
	formatExamLocation,
	formatExamSummary,
	formatHCM,
	formatUTC,
	hcmDateToUtc
} from './utils';

export type IcalOptions = {
	scope?: 'all' | 'classes' | 'exams';
	examRemindersMinutes?: number[];
};

export function escapeIcalText(text: string): string {
	return text.replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * transform calendar into ical format
 * @returns rfc5545 compliant ical calendar
 */
export function formatIcal(timetable: Timetable, options?: IcalOptions): string {
	const scope = options?.scope ?? 'all';
	const examRemindersMinutes = options?.examRemindersMinutes ?? [1440, 60];

	const arr = [
		'BEGIN:VCALENDAR',
		'PRODID:-//bkalendar//BKalendar//VI',
		'VERSION:2.0',
		// below is vtimezone component
		// taken from: https://github.com/touch4it/ical-timezones/blob/master/lib/zones/Asia/Ho_Chi_Minh.ics
		'BEGIN:VTIMEZONE',
		'TZID:Asia/Ho_Chi_Minh',
		'TZURL:http://tzurl.org/zoneinfo-outlook/Asia/Ho_Chi_Minh',
		'X-LIC-LOCATION:Asia/Ho_Chi_Minh',
		'BEGIN:STANDARD',
		'TZOFFSETFROM:+0700',
		'TZOFFSETTO:+0700',
		'TZNAME:+07',
		'DTSTART:19700101T000000',
		'END:STANDARD',
		'END:VTIMEZONE'
	];

	if ((scope === 'all' || scope === 'classes') && timetable.startMondayUTC) {
		for (const timerow of timetable.rows) {
			if (isUnresolvable(timerow)) {
				continue;
			}
			arr.push(...formatTimerow(timerow, timetable.startMondayUTC));
		}
	}

	if (scope === 'all' || scope === 'exams') {
		for (const exam of timetable.exams ?? []) {
			arr.push(...formatExamVevent(exam, examRemindersMinutes));
		}
	}

	arr.push('END:VCALENDAR');
	return arr.join('\r\n');
}

function formatTimerow(tr: Timerow, startMondayUTC: Date): string[] {
	const start = tr.weeks.findIndex(Boolean);
	const recurrence = icalRrule(tr, startMondayUTC, true);
	const rawDescription = Object.entries(tr.extras)
		.map((e) => e.join(': '))
		.join('\n');
	return [
		'BEGIN:VEVENT',
		`UID:${crypto.randomUUID()}@bkalendar`,
		`DTSTAMP:${formatUTC(new Date())}`,
		// info
		`SUMMARY:${escapeIcalText(tr.name)}`,
		`DESCRIPTION:${escapeIcalText(rawDescription)}`,
		`LOCATION:${escapeIcalText(tr.location)}`,
		// time
		`DTSTART;TZID=${ASIA_HO_CHI_MINH}:${formatHCM(
			dateOfIndex(start, tr.startHm, startMondayUTC, tr.weekday)
		)}`,
		`DTEND;TZID=${ASIA_HO_CHI_MINH}:${formatHCM(
			dateOfIndex(start, tr.endHm, startMondayUTC, tr.weekday)
		)}`,
		...recurrence,
		'END:VEVENT'
	];
}

function formatExamVevent(exam: ExamRow, remindersMinutes: number[]): string[] {
	const startUtc = hcmDateToUtc(exam.date, exam.startHm);
	const endUtc = examEndDateUtc(exam);
	const summary = escapeIcalText(formatExamSummary(exam));

	const alarms: string[] = [];
	for (const m of remindersMinutes) {
		if (!Number.isFinite(m) || m < 0) continue;
		const mins = Math.trunc(m);
		alarms.push(
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`DESCRIPTION:${summary}`,
			`TRIGGER:${mins === 1440 ? '-P1D' : `-PT${mins}M`}`,
			'END:VALARM'
		);
	}

	return [
		'BEGIN:VEVENT',
		`UID:${crypto.randomUUID()}@bkalendar`,
		`DTSTAMP:${formatUTC(new Date())}`,
		`SUMMARY:${summary}`,
		`DESCRIPTION:${escapeIcalText(formatExamDescription(exam))}`,
		`LOCATION:${escapeIcalText(formatExamLocation(exam))}`,
		`DTSTART;TZID=${ASIA_HO_CHI_MINH}:${formatHCM(startUtc)}`,
		`DTEND;TZID=${ASIA_HO_CHI_MINH}:${formatHCM(endUtc)}`,
		...alarms,
		'END:VEVENT'
	];
}

/**
 * generate rrule with UNTIL and EXDATE rule
 */
export function icalRrule(
	{ weekday, startHm, weeks }: Timerow,
	startMondayUTC: Date,
	multiline = false
): string[] {
	const start = weeks.findIndex(Boolean);
	const end = weeks.findLastIndex(Boolean);

	// if only one event, no rrule needed
	if (start === end) {
		return [];
	}
	// UNTIL only accepts utc datetime...
	const rrules: string[] = [
		`RRULE:FREQ=WEEKLY;UNTIL=${formatUTC(dateOfIndex(end, startHm, startMondayUTC, weekday))}`
	];

	const excludes: number[] = [];
	for (let i = start; i <= end; i++) {
		if (!weeks[i]) {
			excludes.push(i);
		}
	}
	if (excludes.length !== 0) {
		if (!multiline) {
			rrules.push(
				`EXDATE;TZID=${ASIA_HO_CHI_MINH}:${excludes
					.map((ex) => formatHCM(dateOfIndex(ex, startHm, startMondayUTC, weekday)))
					.join(',')}`
			);
		} else {
			rrules.push(`EXDATE;TZID=${ASIA_HO_CHI_MINH}`);
			rrules.push(` :${formatHCM(dateOfIndex(excludes[0], startHm, startMondayUTC, weekday))}`);
			for (let i = 1; i < excludes.length; i++) {
				rrules.push(` ,${formatHCM(dateOfIndex(excludes[i], startHm, startMondayUTC, weekday))}`);
			}
		}
	}
	return rrules;
}
