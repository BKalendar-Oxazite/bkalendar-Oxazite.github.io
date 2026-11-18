import { ASIA_HO_CHI_MINH } from '../constants';
import { isUnresolvable } from '../resolver';
import type { ExamRow, Timetable } from '../timetable';
import { icalRrule } from './ical';
import {
	dateOfIndex,
	examEndDateUtc,
	formatExamDescription,
	formatExamLocation,
	formatExamSummary,
	formatUTC,
	hcmDateToUtc
} from './utils';

export type GapiEvent = {
	summary: string;
	description: string;
	location: string;
	start: {
		dateTime: string;
		timeZone: string;
	};
	end: {
		dateTime: string;
		timeZone: string;
	};
	recurrence?: string[];
	colorId?: string;
	reminders?: {
		useDefault: boolean;
		overrides: { method: string; minutes: number }[];
	};
};

export type GapiOptions = {
	examRemindersMinutes?: number[];
};

export function formatGapiSplit(
	timetable: Timetable,
	options?: GapiOptions
): { classEvents: GapiEvent[]; examEvents: GapiEvent[] } {
	const examRemindersMinutes = options?.examRemindersMinutes ?? [1440, 60];
	const classEvents: GapiEvent[] = [];
	const examEvents: GapiEvent[] = [];

	if (timetable.startMondayUTC) {
		for (const timerow of timetable.rows) {
			if (isUnresolvable(timerow)) {
				continue;
			}

			const start = timerow.weeks.findIndex(Boolean);
			const recurrence = icalRrule(timerow, timetable.startMondayUTC);
			classEvents.push({
				summary: timerow.name,
				description: Object.entries(timerow.extras)
					.map((e) => e.join(': '))
					.join('\n'),
				location: timerow.location,
				start: {
					dateTime: dateOfIndex(
						start,
						timerow.startHm,
						timetable.startMondayUTC,
						timerow.weekday
					).toISOString(),
					timeZone: ASIA_HO_CHI_MINH
				},
				end: {
					dateTime: dateOfIndex(
						start,
						timerow.endHm,
						timetable.startMondayUTC,
						timerow.weekday
					).toISOString(),
					timeZone: ASIA_HO_CHI_MINH
				},
				recurrence
			});
		}
	}

	const overrides = examRemindersMinutes
		.filter((m) => Number.isFinite(m) && m >= 0)
		.map((m) => ({ method: 'popup', minutes: Math.trunc(m) }));

	for (const exam of timetable.exams ?? []) {
		const startUtc = hcmDateToUtc(exam.date, exam.startHm);
		const endUtc = examEndDateUtc(exam);
		examEvents.push({
			summary: formatExamSummary(exam),
			description: formatExamDescription(exam),
			location: formatExamLocation(exam),
			start: {
				dateTime: startUtc.toISOString(),
				timeZone: ASIA_HO_CHI_MINH
			},
			end: {
				dateTime: endUtc.toISOString(),
				timeZone: ASIA_HO_CHI_MINH
			},
			reminders: {
				useDefault: false,
				overrides
			}
		});
	}

	return { classEvents, examEvents };
}

export function formatGapi(timetable: Timetable, options?: GapiOptions): GapiEvent[] {
	const { classEvents, examEvents } = formatGapiSplit(timetable, options);
	return [...classEvents, ...examEvents];
}

export function formatGoogleCalendarTemplateUrl(exam: ExamRow): string {
	const startUtc = hcmDateToUtc(exam.date, exam.startHm);
	const endUtc = examEndDateUtc(exam);
	const url = new URL('https://calendar.google.com/calendar/render');
	url.searchParams.set('action', 'TEMPLATE');
	url.searchParams.set('text', formatExamSummary(exam));
	url.searchParams.set('dates', `${formatUTC(startUtc)}/${formatUTC(endUtc)}`);
	url.searchParams.set('location', formatExamLocation(exam));
	url.searchParams.set('details', formatExamDescription(exam));
	url.searchParams.set('ctz', ASIA_HO_CHI_MINH);
	return url.toString();
}
