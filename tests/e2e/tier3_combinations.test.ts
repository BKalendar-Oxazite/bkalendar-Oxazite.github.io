import { describe, expect, it } from 'vitest';
import { MixedSemesterError, resolve, UnresolvedError } from '$lib/core/resolver';
import { ParseError, TableNotFoundError } from '$lib/core/parser/errors';
import type { Timetable } from '$lib/core/timetable';
import {
	defaultCalendarName,
	loadLibModule,
	makeSyntheticExam2024,
	makeSyntheticTkb2024,
	normalizeIcalVolatileFields,
	PASTE_1_NL,
	PASTE_1_PAGE2_NL,
	PASTE_2_NL,
	PASTE_2_TSV,
	rowMatchesCourse,
	runInTimezone,
	unfoldIcal,
	type ColorsExports,
	type LecturerExports,
	type ModExports,
	type PostgradExports,
	type StudentExports
} from './fixtures';

describe('Tier 3 — Pairwise Cross-Feature Combinations (T3-01..T3-20)', () => {
	describe('Group A: TKB + Exam Merge -> resolve -> formatIcal', () => {
		it('T3-01: merged Paste #1 + Paste #2 with default formatIcal emits 18 VEVENTs and 18 VALARMs', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const ics = mod.formatIcal(merged);
			expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
			expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
			expect(ics).toContain('VERSION:2.0');
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(18);
			expect(ics.match(/END:VEVENT/g)).toHaveLength(18);
			expect(ics.match(/RRULE:/g)).toHaveLength(9);
			expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(18);
			expect(ics.match(/TRIGGER:-P1D/g)).toHaveLength(9);
			expect(ics.match(/TRIGGER:-PT60M/g)).toHaveLength(9);
			expect(ics).toMatch(/DESCRIPTION:.*\\n/);
		});

		it('T3-02: formatIcal({ scope: "classes" }) emits only 9 class VEVENTs and preserves both CO2011 rows', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const ics = unfoldIcal(mod.formatIcal(merged, { scope: 'classes' }));
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(ics.match(/RRULE:/g)).toHaveLength(9);
			expect(ics).not.toContain('[CK]');
			expect(ics).not.toContain('[GK]');
			expect(ics).not.toContain('BEGIN:VALARM');
			expect(ics.match(/SUMMARY:.*Mô hình hóa Toán học/g)).toHaveLength(2);
		});

		it('T3-03: formatIcal({ scope: "exams" }) emits 9 exam VEVENTs with summaries, locations, and 18 VALARMs', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const ics = mod.formatIcal(merged, { scope: 'exams' });
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(ics).not.toContain('RRULE:');
			expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(18);
			expect(ics).toContain('SUMMARY:[CK] CO2011 - Mô hình hóa Toán học');
			expect(ics).toContain('LOCATION:B4-305 (BK-CS1)');
			expect(ics).toContain('SUMMARY:[CK] SP1033 - Kinh tế Chính trị Mác - Lênin');
			expect(ics).toContain('SUMMARY:[GK] CO2003 - Cấu trúc Dữ liệu và Giải Thuật');
		});

		it('T3-04: formatIcal with custom examRemindersMinutes: [30, 120] overrides default -P1D/-PT60M', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const ics = mod.formatIcal(merged, { scope: 'all', examRemindersMinutes: [30, 120] });
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(18);
			expect(ics.match(/TRIGGER:-PT30M/g)).toHaveLength(9);
			expect(ics.match(/TRIGGER:-PT120M/g)).toHaveLength(9);
			expect(ics).not.toContain('TRIGGER:-P1D');
			expect(ics).not.toContain('TRIGGER:-PT60M');
		});

		it('T3-05: formatIcal with examRemindersMinutes: [] emits 0 VALARMs and preserves \\n DESCRIPTION escaping', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const ics = mod.formatIcal(merged, { scope: 'exams', examRemindersMinutes: [] });
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(ics).not.toContain('BEGIN:VALARM');
			const descLines = ics
				.replace(/\r\n/g, '\n')
				.split('\n')
				.filter((l) => l.startsWith('DESCRIPTION:'));
			expect(descLines).toHaveLength(9);
			for (const line of descLines) {
				expect(line).toContain('\\n');
			}
		});
	});

	describe('Group B: TKB + Exam Merge -> formatGapiSplit / formatGapi x colors.ts', () => {
		it('T3-06: formatGapiSplit x courseColorIds + Tomato 11 highlights exams and groups CO2011', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const { classEvents, examEvents } = mod.formatGapiSplit(merged);
			expect(classEvents).toHaveLength(9);
			expect(examEvents).toHaveLength(9);

			const classColors = colors.courseColorIds(classEvents);
			const validKeys = new Set(colors.COLORS.keys());
			classEvents.forEach((ev, idx) => {
				expect(validKeys.has(classColors[idx])).toBe(true);
				expect(ev.start.timeZone).toBe('Asia/Ho_Chi_Minh');
				expect(ev.end.timeZone).toBe('Asia/Ho_Chi_Minh');
				expect((ev.recurrence ?? []).length).toBeGreaterThan(0);
			});

			const co2011Idx = classEvents
				.map((e, i) => (e.summary.includes('CO2011') || e.summary.includes('Mô hình hóa') ? i : -1))
				.filter((i) => i >= 0);
			expect(co2011Idx).toHaveLength(2);
			expect(classColors[co2011Idx[0]]).toBe(classColors[co2011Idx[1]]);

			const highlightedExams = examEvents.map((e) => ({
				...e,
				colorId: colors.EXAM_TOMATO_COLOR_ID
			}));
			for (const ex of highlightedExams) {
				expect(ex.colorId).toBe('11');
				expect(ex.recurrence).toBeUndefined();
				expect(ex.reminders).toEqual({
					useDefault: false,
					overrides: [
						{ method: 'popup', minutes: 1440 },
						{ method: 'popup', minutes: 60 }
					]
				});
			}
		});

		it('T3-07: formatGapiSplit({ examRemindersMinutes: [15, 720] }) x randomColorIds + Tomato 11', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const { classEvents, examEvents } = mod.formatGapiSplit(merged, {
				examRemindersMinutes: [15, 720]
			});
			const randColors = [...colors.randomColorIds(classEvents.length)];
			expect(randColors).toHaveLength(9);
			for (const id of randColors) {
				expect(colors.COLORS.has(id)).toBe(true);
			}

			for (const ex of examEvents) {
				expect(ex.reminders).toEqual({
					useDefault: false,
					overrides: [
						{ method: 'popup', minutes: 15 },
						{ method: 'popup', minutes: 720 }
					]
				});
			}

			const co2011Ck = examEvents.find((e) => e.summary.startsWith('[CK] CO2011'));
			expect(co2011Ck).toBeDefined();
			expect(Date.parse(co2011Ck!.start.dateTime)).toBe(Date.UTC(2026, 11, 28, 0, 0, 0));
			expect(Date.parse(co2011Ck!.end.dateTime)).toBe(Date.UTC(2026, 11, 28, 1, 20, 0));
			expect(co2011Ck?.location).toBe('B4-305 (BK-CS1)');
		});

		it('T3-08: formatGapi combined x courseColorIds links class and exam courses deterministically', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const events = mod.formatGapi(merged);
			expect(events).toHaveLength(18);
			const pass1 = colors.courseColorIds(events);
			const pass2 = colors.courseColorIds(events);
			expect(pass1).toEqual(pass2);

			const co2003Indices = events
				.map((e, i) =>
					/^\[[^\]]+\] CO2003\b/.test(e.summary) || e.description?.includes('mã môn học: CO2003')
						? i
						: -1
				)
				.filter((i) => i >= 0);
			const distinctCo2003 = new Set(co2003Indices.map((i) => pass1[i]));
			expect(co2003Indices.length).toBeGreaterThanOrEqual(3);
			expect(distinctCo2003.size).toBe(1);
		});

		it('T3-09: formatGapiSplit in mono mode leaves colorId unset and preserves valid RFC 3339 timestamps', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const { classEvents, examEvents } = mod.formatGapiSplit(merged);
			const all = [...classEvents, ...examEvents];
			expect(all).toHaveLength(18);
			for (const ev of all) {
				expect(ev.colorId).toBeUndefined();
				expect(ev.start.dateTime).toMatch(
					/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|\+07:00)$/
				);
				expect(ev.end.dateTime).toMatch(
					/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|\+07:00)$/
				);
				expect(Date.parse(ev.end.dateTime)).toBeGreaterThan(Date.parse(ev.start.dateTime));
				expect(ev.start.timeZone).toBe('Asia/Ho_Chi_Minh');
				expect(ev.end.timeZone).toBe('Asia/Ho_Chi_Minh');
			}
		});
	});

	describe('Group C: Cross-Timezone Child-Process Pipeline Invariance', () => {
		it('T3-10: America/New_York vs Asia/Ho_Chi_Minh produce identical startMondayUTC and normalized .ics', () => {
			const run = (tz: string) =>
				runInTimezone<{ tz: string; semester: number; iso: string; ics: string }>(
					tz,
					`
					const mod = await server.ssrLoadModule('$lib/core/mod');
					const merged = mod.mergeTimetables([
						mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)}),
						mod.parseExam2024(${JSON.stringify(PASTE_2_NL)})
					]);
					mod.resolve(merged);
					return {
						tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
						semester: merged.semester,
						iso: merged.startMondayUTC?.toISOString(),
						ics: mod.formatIcal(merged)
					};
					`
				);
			const ny = run('America/New_York');
			const hcm = run('Asia/Ho_Chi_Minh');
			expect(ny.tz).toBe('America/New_York');
			expect(hcm.tz).toMatch(/Asia\/(Ho_Chi_Minh|Saigon)/);
			expect(ny.semester).toBe(261);
			expect(ny.iso).toBe('2026-08-24T00:00:00.000Z');
			expect(ny.iso).toBe(hcm.iso);
			expect(normalizeIcalVolatileFields(ny.ics)).toBe(normalizeIcalVolatileFields(hcm.ics));
		});

		it('T3-11: America/New_York vs Asia/Ho_Chi_Minh produce byte-identical formatGapiSplit & TEMPLATE URLs', () => {
			const run = (tz: string) =>
				runInTimezone<{ split: unknown; urls: string[] }>(
					tz,
					`
					const mod = await server.ssrLoadModule('$lib/core/mod');
					const merged = mod.mergeTimetables([
						mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)}),
						mod.parseExam2024(${JSON.stringify(PASTE_2_NL)})
					]);
					mod.resolve(merged);
					return {
						split: mod.formatGapiSplit(merged),
						urls: (merged.exams ?? []).map((e) => mod.formatGoogleCalendarTemplateUrl(e))
					};
					`
				);
			expect(run('America/New_York')).toEqual(run('Asia/Ho_Chi_Minh'));
		});
	});

	describe('Group D: Multi-Page Paginated Merge, Naming, Metadata & Dedup', () => {
		it('T3-12: paginated Page 1 + Page 2 merge deduplicates SP1033, preserves CO2011 split-weeks, adds 3 unique rows', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const p1 = mod.parseStudent2024(PASTE_1_NL);
			p1.metadata = mod.extractMeta(PASTE_1_NL);
			const p2 = mod.parseStudent2024(PASTE_1_PAGE2_NL);
			p2.metadata = mod.extractMeta(PASTE_1_PAGE2_NL);
			const merged = mod.mergeTimetables([p1, p2]);
			mod.resolve(merged);

			expect(merged.rows).toHaveLength(12);
			expect(
				merged.rows.filter((r) => rowMatchesCourse(r, 'SP1033', 'Kinh tế Chính trị Mác - Lênin'))
			).toHaveLength(1);
			expect(
				merged.rows.filter((r) => rowMatchesCourse(r, 'CO2011', 'Mô hình hóa Toán học'))
			).toHaveLength(2);
			expect(merged.rows.some((r) => rowMatchesCourse(r, 'CO2007', 'Kiến trúc Máy tính'))).toBe(
				true
			);
			expect(merged.rows.some((r) => rowMatchesCourse(r, 'MT1003', 'Giải tích 1'))).toBe(true);
			expect(merged.rows.some((r) => rowMatchesCourse(r, 'PH1003', 'Vật lý 1'))).toBe(true);
			expect(merged.metadata?.studentName).toBe('SINH VIÊN MẪU');
			expect(merged.metadata?.studentId).toBe('DEMO-STUDENT-ID');
			expect(p1.metadata?.pagination).toEqual({ shownFrom: 1, shown: 10, total: 13 });
		});

		it('T3-13: default calendar naming produces SV261 for merged/TKB and THI261 for exam-only', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const tkb = mod.parseStudent2024(PASTE_1_NL);
			const exam = mod.parseExam2024(PASTE_2_NL);
			const merged = mod.mergeTimetables([tkb, exam]);

			expect(defaultCalendarName(merged)).toBe('SV261');
			expect(`${defaultCalendarName(merged)}.ics`).toBe('SV261.ics');
			expect(defaultCalendarName(exam)).toBe('THI261');
			expect(`${defaultCalendarName(exam)}.ics`).toBe('THI261.ics');
		});

		it('T3-14: semester mismatch throws in mergeTimetables and MixedSemesterError in resolve', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const tkb261 = mod.parseStudent2024(PASTE_1_NL);
			const exam262 = mod.parseExam2024(
				makeSyntheticExam2024(
					'20262 - Học kỳ 2 Năm học 2026 - 2027',
					[
						[
							'20262',
							'CO2011 - Mô hình hóa Toán học',
							'CC01',
							'2027-05-10',
							'CK',
							'BK-CS1',
							'B4-305',
							'2',
							'07g00',
							'80',
							'2027-04-01 10:00:00'
						]
					],
					{ tsv: true }
				)
			);
			expect(() => mod.mergeTimetables([tkb261, exam262])).toThrow();

			const conflicting: Timetable = {
				semester: 261,
				rows: [
					{
						name: 'A',
						weekday: 2,
						startHm: [7, 0],
						endHm: [8, 50],
						weeks: [35, 36],
						location: 'B1',
						extras: {}
					},
					{
						name: 'B',
						weekday: 3,
						startHm: [7, 0],
						endHm: [8, 50],
						weeks: [null, 38],
						location: 'B1',
						extras: {}
					}
				]
			};
			expect(() => resolve(conflicting)).toThrow(MixedSemesterError);
		});

		it('T3-15: SA0002-only TKB + Paste #2 exams resolves cleanly while SA0002 alone throws UnresolvedError', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const saOnlySrc = makeSyntheticTkb2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'SA0002',
						'Sinh hoạt Sinh viên',
						'0',
						'0',
						'CC77',
						'--',
						'--',
						'--',
						'CS1',
						'BK-CS1',
						'35|36|'
					]
				],
				{ tsv: true }
			);
			const saOnly = mod.parseStudent2024(saOnlySrc);
			expect(saOnly.rows).toHaveLength(0);
			expect(() => resolve(saOnly)).toThrow(UnresolvedError);

			const merged = mod.mergeTimetables([saOnly, mod.parseExam2024(PASTE_2_NL)]);
			expect(() => mod.resolve(merged)).not.toThrow();
			expect(merged.startMondayUTC).toBeUndefined();
			expect(merged.exams).toHaveLength(9);
		});
	});

	describe('Group E: formatGoogleCalendarTemplateUrl Paired with Exam Parsing', () => {
		it('T3-16: Paste #2 (NL and TSV) produces identical valid TEMPLATE URLs for CK, GK, and hyphenated names', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const nlExams = mod.parseExam2024(PASTE_2_NL).exams ?? [];
			const tsvExams = mod.parseExam2024(PASTE_2_TSV).exams ?? [];

			const nlUrls = nlExams.map((e) => mod.formatGoogleCalendarTemplateUrl(e));
			const tsvUrls = tsvExams.map((e) => mod.formatGoogleCalendarTemplateUrl(e));
			expect(nlUrls).toEqual(tsvUrls);
			expect(nlUrls).toHaveLength(9);

			for (const urlStr of nlUrls) {
				expect(urlStr.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
				const p = new URL(urlStr).searchParams;
				expect(p.get('action')).toBe('TEMPLATE');
				expect(p.get('ctz')).toBe('Asia/Ho_Chi_Minh');
			}

			const co2011Ck = new URL(nlUrls[0]).searchParams;
			expect(co2011Ck.get('dates')).toBe('20261228T000000Z/20261228T012000Z');
			expect(co2011Ck.get('text')).toBe('[CK] CO2011 - Mô hình hóa Toán học');
			expect(co2011Ck.get('location')).toBe('B4-305 (BK-CS1)');

			const sp1033Ck = new URL(nlUrls[1]).searchParams;
			expect(sp1033Ck.get('text')).toBe('[CK] SP1033 - Kinh tế Chính trị Mác - Lênin');
			expect(sp1033Ck.get('dates')).toBe('20261231T023000Z/20261231T032000Z');

			const co2003Gk = new URL(nlUrls[6]).searchParams;
			expect(co2003Gk.get('text')).toBe('[GK] CO2003 - Cấu trúc Dữ liệu và Giải Thuật');
			expect(co2003Gk.get('dates')).toBe('20261015T000000Z/20261015T010000Z');
		});

		it('T3-17: 06:30 HCM exam rolls back to previous UTC day in TEMPLATE URL while GAPI stays +07:00', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const src = makeSyntheticExam2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'CO2001 - Early Morning Test',
						'CC01',
						'2026-12-28',
						'CK',
						'BK-CS1',
						'B4-101',
						'2',
						'06:30',
						'60',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			const tt = mod.parseExam2024(src);
			const exam = tt.exams![0];
			expect(exam.startHm).toEqual([6, 30]);
			expect(exam.endHm).toEqual([7, 30]);

			const url = new URL(mod.formatGoogleCalendarTemplateUrl(exam));
			expect(url.searchParams.get('dates')).toBe('20261227T233000Z/20261228T003000Z');

			const { examEvents } = mod.formatGapiSplit(tt);
			// 2026-12-28 06:30..07:30 +07:00 == 2026-12-27T23:30:00Z..2026-12-28T00:30:00Z
			expect(Date.parse(examEvents[0].start.dateTime)).toBe(Date.UTC(2026, 11, 27, 23, 30, 0));
			expect(Date.parse(examEvents[0].end.dateTime)).toBe(Date.UTC(2026, 11, 28, 0, 30, 0));
			expect(examEvents[0].start.timeZone).toBe('Asia/Ho_Chi_Minh');
		});
	});

	describe('Group F: Legacy Formats x mod.ts Exports & Contracts', () => {
		it('T3-18: legacy parseStudent integrates with mod.ts exports and typed error contracts', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const direct = await loadLibModule<StudentExports>('core/parser/student.ts');
			expect(mod.parseStudent).toBe(direct.parseStudent);
			expect(() => direct.parseStudent('missing semester')).toThrow(ParseError);
			expect(() => direct.parseStudent('20231 - Học kỳ 1 Năm học 2023 - 2024\nno table')).toThrow(
				TableNotFoundError
			);
		});

		it('T3-19: legacy parseLecturer integrates with mod.ts exports and formatter contracts', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const direct = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			expect(mod.parseLecturer).toBe(direct.parseLecturer);
			expect(() => direct.parseLecturer('20231 - Học kỳ 1\nno table')).toThrow(ParseError);

			// Verify Timetable formatted via resolve + formatIcal + formatGapi contract
			const legacyShape: Timetable = {
				semester: 231,
				rows: [
					{
						name: 'CO1005 - Nhập môn Điện toán (L01)',
						weekday: 2,
						startHm: [7, 0],
						endHm: [8, 50],
						weeks: [35, 36, 37],
						location: 'B1-101',
						extras: { group: 'L01' }
					}
				]
			};
			mod.resolve(legacyShape);
			expect(legacyShape.startMondayUTC?.getUTCDay()).toBe(1);
			expect(mod.formatIcal(legacyShape)).toContain('RRULE:');
			expect(mod.formatGapi(legacyShape)[0].start.timeZone).toBe('Asia/Ho_Chi_Minh');
		});

		it('T3-20: legacy parsePostgrad loads standalone and matches mod.ts + typed error contracts', async () => {
			const direct = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			expect(mod.parsePostgrad).toBe(direct.parsePostgrad);
			expect(() => direct.parsePostgrad('')).toThrow(ParseError);
			expect(() => direct.parsePostgrad('20231 - Học kỳ 1\nno table')).toThrow(TableNotFoundError);
		});
	});
});
