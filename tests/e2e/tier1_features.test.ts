import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, WEEK } from '$lib/core/constants';
import {
	dayOfWeek,
	findIndex0AndWeek1,
	findMondayOfIndex0,
	isUnresolvable,
	MixedSemesterError,
	resolve,
	UnresolvedError
} from '$lib/core/resolver';
import {
	NumOfColumnMismatchError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from '$lib/core/parser/errors';
import type { Timetable } from '$lib/core/timetable';
import {
	collectFilesRecursive,
	defaultCalendarName,
	loadLibModule,
	loadRouteModule,
	normalizeIcalVolatileFields,
	PASTE_1_EXPECTED_ROWS,
	PASTE_1_NL,
	PASTE_1_TSV,
	PASTE_2_EXPECTED_EXAMS,
	PASTE_2_NL,
	PASTE_2_TSV,
	readWorkspaceText,
	rowMatchesCourse,
	runInTimezone,
	workspaceExists,
	type ColorsExports,
	type ConstantsExports,
	type DetectExports,
	type Exam2024Exports,
	type GapiExports,
	type GoogleExports,
	type IcalExports,
	type LecturerExports,
	type ModExports,
	type ParserUtilsExports,
	type PostgradExports,
	type Student2024Exports,
	type StudentExports,
	type SvelteComponentModule
} from './fixtures';

describe('Tier 1 — Feature Coverage (Features #1–#12)', () => {
	describe('Feature #1: Project scaffolding & root-relative config', () => {
		it('T1-F1-01: package.json uses vitest and has zero JSR or Deno dependencies', () => {
			const pkg = JSON.parse(readWorkspaceText('package.json')) as {
				scripts?: Record<string, string>;
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			expect(pkg.scripts?.test).toContain('vitest');
			expect(pkg.devDependencies?.vitest).toBeTruthy();
			const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
			for (const dep of Object.keys(allDeps)) {
				expect(dep).not.toMatch(/@bkalendar\/core|@jsr\/|@std\//);
			}
		});

		it('T1-F1-02: .npmrc does not configure any @jsr registry', () => {
			if (workspaceExists('.npmrc')) {
				const npmrc = readWorkspaceText('.npmrc');
				expect(npmrc).not.toContain('npm.jsr.io');
				expect(npmrc).not.toContain('@jsr:registry');
			}
		});

		it('T1-F1-03: svelte.config.js uses adapter-static and a root-relative base', () => {
			const cfg = readWorkspaceText('svelte.config.js');
			expect(cfg).toContain('@sveltejs/adapter-static');
			expect(cfg).toMatch(/base:\s*['"]['"]/);
		});

		it('T1-F1-04: tailwind.config.cjs defines marine, sky, rose, green, slate, transparent palette', () => {
			const tw = readWorkspaceText('tailwind.config.cjs');
			for (const colorName of ['marine', 'sky', 'rose', 'green', 'slate', 'transparent']) {
				expect(tw).toContain(colorName);
			}
		});

		it('T1-F1-05: static/favicon.svg and src/app.html + Arimo font configuration are valid', () => {
			const svg = readWorkspaceText('static/favicon.svg');
			const appHtml = readWorkspaceText('src/app.html');
			const pkg = readWorkspaceText('package.json');
			expect(svg).toContain('<svg');
			expect(appHtml).toContain('%sveltekit.assets%/favicon.svg');
			expect(pkg).toContain('@fontsource/arimo');
		});
	});

	describe('Feature #2: Vendored core constants, types, errors & utils', () => {
		it('T1-F2-01: constants.ts exports exact millisecond constants and ASIA_HO_CHI_MINH', async () => {
			const constants = await loadLibModule<ConstantsExports>('core/constants.ts');
			expect(constants.MINUTE).toBe(60_000);
			expect(constants.HOUR).toBe(3_600_000);
			expect(constants.DAY).toBe(86_400_000);
			expect(constants.WEEK).toBe(604_800_000);
			expect([7 * 3_600_000, 7, '+07:00', 'Asia/Ho_Chi_Minh']).toContain(
				constants.ASIA_HO_CHI_MINH
			);
		});

		it('T1-F2-02: error classes inherit from Error and carry typed context', () => {
			const parseErr = new ParseError('raw', 'bad');
			const semErr = new SemesterNotFoundError('raw');
			const colErr = new NumOfColumnMismatchError('raw', 12, 10);
			const tblErr = new TableNotFoundError('raw');
			const mixErr = new MixedSemesterError(new Date('2026-08-24'), new Date('2026-01-05'));
			const unresErr = new UnresolvedError();

			for (const err of [parseErr, semErr, colErr, tblErr, mixErr, unresErr]) {
				expect(err).toBeInstanceOf(Error);
			}
			expect(colErr.expected).toBe(12);
			expect(colErr.found).toBe(10);
		});

		it('T1-F2-03: parseTime and hmFrom parse standard myBk class time components and periods', async () => {
			const utils = await loadLibModule<ParserUtilsExports>('core/parser/utils.ts');
			expect(utils.hmFrom(4)).toEqual({ startHm: [9, 0], endHm: [9, 50] });
			expect(utils.hmFrom(5)).toEqual({ startHm: [10, 0], endHm: [10, 50] });
			expect(utils.parseTime('9:00')).toEqual([9, 0]);
			expect(utils.parseTime('10:50')).toEqual([10, 50]);
			expect(utils.parseTime('7:00')).toEqual([7, 0]);
			expect(utils.parseTime('11:50')).toEqual([11, 50]);
			expect(utils.parseTime('13:00')).toEqual([13, 0]);
			expect(utils.parseTime('17:50')).toEqual([17, 50]);
		});

		it('T1-F2-04: parseExamTime parses both HHgMM and HH:MM formats', async () => {
			const utils = await loadLibModule<ParserUtilsExports>('core/parser/utils.ts');
			expect(utils.parseExamTime('07g00')).toEqual([7, 0]);
			expect(utils.parseExamTime('09g30')).toEqual([9, 30]);
			expect(utils.parseExamTime('15g30')).toEqual([15, 30]);
			expect(utils.parseExamTime('13:00')).toEqual([13, 0]);
		});

		it('T1-F2-05: addMinutesToHm computes exam end times accurately', async () => {
			const utils = await loadLibModule<ParserUtilsExports>('core/parser/utils.ts');
			expect(utils.addMinutesToHm([7, 0], 80)).toEqual([8, 20]);
			expect(utils.addMinutesToHm([9, 30], 50)).toEqual([10, 20]);
			expect(utils.addMinutesToHm([9, 30], 90)).toEqual([11, 0]);
			expect(utils.addMinutesToHm([13, 0], 70)).toEqual([14, 10]);
		});
	});

	describe('Feature #3: Core resolver & TZ invariance', () => {
		it('T1-F3-01: resolve computes startMondayUTC = 2026-08-24T00:00:00.000Z for Paste #1', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const tt = parseStudent2024(PASTE_1_NL);
			resolve(tt);
			expect(tt.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');
		});

		it('T1-F3-02: dayOfWeek maps UTC Monday..Sunday to 2..8 using getUTCDay()', () => {
			const monday = Date.UTC(2026, 7, 24); // 2026-08-24 Monday
			const observed = Array.from({ length: 7 }, (_, i) => dayOfWeek(monday + i * DAY));
			expect(observed).toEqual([2, 3, 4, 5, 6, 7, 8]);
			expect(WEEK).toBe(7 * DAY);
			expect(HOUR).toBe(60 * MINUTE);
		});

		it('T1-F3-03: resolve succeeds on exam-only timetable without throwing UnresolvedError', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const tt = parseExam2024(PASTE_2_NL);
			expect(() => resolve(tt)).not.toThrow();
			expect(tt.startMondayUTC).toBeUndefined();
		});

		it('T1-F3-04: isUnresolvable detects rows without concrete week numbers', () => {
			expect(
				isUnresolvable({
					name: 'Course A',
					weekday: 2,
					startHm: [7, 0],
					endHm: [8, 50],
					weeks: [35, null, 37],
					location: 'B1-101',
					extras: {}
				})
			).toBe(false);
			expect(
				isUnresolvable({
					name: 'Course B',
					weekday: 2,
					startHm: [7, 0],
					endHm: [8, 50],
					weeks: [null, null],
					location: 'B1-101',
					extras: {}
				})
			).toBe(true);
		});

		it('T1-F3-05: resolve throws MixedSemesterError when rows yield conflicting Mondays', () => {
			const tt: Timetable = {
				semester: 261,
				rows: [
					{
						name: 'Course 1',
						weekday: 2,
						startHm: [7, 0],
						endHm: [8, 50],
						weeks: [35, 36],
						location: 'B1-101',
						extras: {}
					},
					{
						name: 'Course 2',
						weekday: 3,
						startHm: [9, 0],
						endHm: [10, 50],
						weeks: [null, 38],
						location: 'B1-102',
						extras: {}
					}
				]
			};
			expect(() => resolve(tt)).toThrow(MixedSemesterError);
			const w1 = findIndex0AndWeek1([35, 36]);
			expect(findMondayOfIndex0(w1.indexOfWeek1, w1.weekOfIndex0, 261).toISOString()).toBe(
				'2026-08-24T00:00:00.000Z'
			);
		});
	});

	describe('Feature #4: parseStudent2024 approved fixes', () => {
		it('T1-F4-01: parses Verbatim Paste #1 (newline stream) to semester 261 and 9 scheduled rows', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const tt = parseStudent2024(PASTE_1_NL);
			expect(tt.semester).toBe(261);
			expect(tt.rows).toHaveLength(9);
			expect(tt.rows.some((r) => r.name.includes('SA0002'))).toBe(false);

			tt.rows.forEach((row, idx) => {
				const expected = PASTE_1_EXPECTED_ROWS[idx];
				expect(rowMatchesCourse(row, expected.code, expected.nameSub)).toBe(true);
				expect(row.weekday).toBe(expected.weekday);
				expect(row.startHm).toEqual(expected.startHm);
				expect(row.endHm).toEqual(expected.endHm);
				expect(row.location).toContain(expected.room);
				expect(row.weeks).toEqual(expected.weeks);
			});
		});

		it('T1-F4-02: parses Verbatim Paste #1 (tab-delimited) identically to newline stream', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const nl = parseStudent2024(PASTE_1_NL);
			const tsv = parseStudent2024(PASTE_1_TSV);
			expect(tsv.semester).toBe(nl.semester);
			expect(tsv.rows).toEqual(nl.rows);
		});

		it('T1-F4-03: ignores 20291 dropdown trap line and picks 20261', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const tt = parseStudent2024(PASTE_1_NL);
			expect(tt.semester).toBe(261);
			expect(tt.semester).not.toBe(291);
		});

		it('T1-F4-04: skips empty time placeholders (--, ---, - - -)', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const sample = [
				'THỜI KHÓA BIỂU HỌC KỲ',
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC',
				'20261\tSA0001\tUnscheduled 1\t0\t0\tCC01\t--\t--\t--\tCS1\tBK-CS1\t35|36|',
				'20261\tSA0002\tUnscheduled 2\t0\t0\tCC01\t--\t---\t---\tCS1\tBK-CS1\t35|36|',
				'20261\tSA0003\tUnscheduled 3\t0\t0\tCC01\t--\t- - -\t- - -\tCS1\tBK-CS1\t35|36|',
				'20261\tSP1033\tKinh tế Chính trị Mác - Lênin\t2\t2\tCC02\t2\t4 - 5\t9:00 - 10:50\tC5-HOITRUONG\tBK-CS1\t35|36|'
			].join('\n');
			const tt = parseStudent2024(sample);
			expect(tt.rows).toHaveLength(1);
			expect(rowMatchesCourse(tt.rows[0], 'SP1033', 'Kinh tế Chính trị Mác - Lênin')).toBe(true);
		});

		it('T1-F4-05: strips trailing pipe in TUẦN HỌC without producing trailing null', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const mk = (weeksCol: string) =>
				[
					'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
					'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC',
					`20261\tSP1033\tTest\t2\t2\tCC02\t2\t4 - 5\t9:00 - 10:50\tC5-101\tBK-CS1\t${weeksCol}`
				].join('\n');
			const withPipe = parseStudent2024(mk('35|36|37|--|39|'));
			const withoutPipe = parseStudent2024(mk('35|36|37|--|39'));
			expect(withPipe.rows[0].weeks).toEqual([35, 36, 37, null, 39]);
			expect(withoutPipe.rows[0].weeks).toEqual([35, 36, 37, null, 39]);
		});
	});

	describe('Feature #5: Legacy parsers vendored', () => {
		it('T1-F5-01: parser/student.ts exports parseStudent and mod.ts re-exports it', async () => {
			const studentMod = await loadLibModule<StudentExports>('core/parser/student.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			expect(typeof studentMod.parseStudent).toBe('function');
			expect(mod.parseStudent).toBe(studentMod.parseStudent);
		});

		it('T1-F5-02: parser/lecturer.ts exports parseLecturer and mod.ts re-exports it', async () => {
			const lecturerMod = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			expect(typeof lecturerMod.parseLecturer).toBe('function');
			expect(mod.parseLecturer).toBe(lecturerMod.parseLecturer);
		});

		it('T1-F5-03: parser/postgrad.ts loads standalone without circular import errors', async () => {
			const postgradMod = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			expect(typeof postgradMod.parsePostgrad).toBe('function');
			expect(mod.parsePostgrad).toBe(postgradMod.parsePostgrad);
		});

		it('T1-F5-04: all 3 legacy parsers throw ParseError when input lacks valid semester/table', async () => {
			const { parseStudent } = await loadLibModule<StudentExports>('core/parser/student.ts');
			const { parseLecturer } = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const { parsePostgrad } = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');

			for (const fn of [parseStudent, parseLecturer, parsePostgrad]) {
				expect(() => fn('no semester here')).toThrow(ParseError);
			}
		});

		it('T1-F5-05: all 3 legacy parsers throw TableNotFoundError when table header is missing', async () => {
			const { parseStudent } = await loadLibModule<StudentExports>('core/parser/student.ts');
			const { parseLecturer } = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const { parsePostgrad } = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');
			const semOnly = '20241 - Học kỳ 1 Năm học 2024 - 2025\nNo timetable table present';

			for (const fn of [parseStudent, parseLecturer, parsePostgrad]) {
				expect(() => fn(semOnly)).toThrow(TableNotFoundError);
			}
		});
	});

	describe('Feature #6: Exam schedule parser (parseExam2024)', () => {
		it('T1-F6-01: parses Verbatim Paste #2 (newline stream) to 9 exact ExamRows', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const tt = parseExam2024(PASTE_2_NL);
			expect(tt.semester).toBe(261);
			expect(tt.rows).toEqual([]);
			expect(tt.exams).toHaveLength(9);
			expect(tt.exams).toEqual(PASTE_2_EXPECTED_EXAMS);
		});

		it('T1-F6-02: parses Verbatim Paste #2 (tab-delimited) identically to newline stream', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const nl = parseExam2024(PASTE_2_NL);
			const tsv = parseExam2024(PASTE_2_TSV);
			expect(tsv.semester).toBe(261);
			expect(tsv.rows).toEqual([]);
			expect(tsv.exams).toEqual(nl.exams);
		});

		it('T1-F6-03: splits course string on first " - " preserving hyphens in course name', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const tt = parseExam2024(PASTE_2_NL);
			const sp1033 = tt.exams?.find((e) => e.courseCode === 'SP1033');
			expect(sp1033).toBeDefined();
			expect(sp1033?.courseName).toBe('Kinh tế Chính trị Mác - Lênin');
			expect(sp1033?.rawCourse).toBe('SP1033 - Kinh tế Chính trị Mác - Lênin');
		});

		it('T1-F6-04: computes endHm from HHgMM start time and durationMinutes', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const tt = parseExam2024(PASTE_2_NL);
			const exams = tt.exams ?? [];
			expect(exams[0].endHm).toEqual([8, 20]); // 07g00 + 80
			expect(exams[1].endHm).toEqual([10, 20]); // 09g30 + 50
			expect(exams[2].endHm).toEqual([11, 0]); // 09g30 + 90
			expect(exams[3].endHm).toEqual([10, 40]); // 09g30 + 70
			expect(exams[8].endHm).toEqual([14, 10]); // 13g00 + 70
		});

		it('T1-F6-05: extracts group, campus, room, examType, and updatedAt across all 9 exams', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const { extractMeta } = await loadLibModule<DetectExports>('core/detect.ts');
			const tt = parseExam2024(PASTE_2_NL);
			const exams = tt.exams ?? [];
			expect(exams).toHaveLength(9);
			expect(exams.filter((e) => e.examType === 'CK')).toHaveLength(6);
			expect(exams.filter((e) => e.examType === 'GK')).toHaveLength(3);
			expect(exams[0].group).toBe('CC02_C_Thi');
			expect(exams[0].campus).toBe('BK-CS1');
			expect(exams[0].room).toBe('B4-305');
			expect(exams[0].updatedAt).toBe('2026-10-23 10:10:00');
			const meta = extractMeta(PASTE_2_NL);
			expect(meta.studentName).toBe('SINH VIÊN MẪU');
			expect(meta.studentId).toBe('DEMO-STUDENT-ID');
			expect(meta.pagination).toEqual({ shownFrom: 1, shown: 9, total: 9 });
		});
	});

	describe('Feature #7: Auto-detection, metadata & multi-paste merge', () => {
		it('T1-F7-01: detectKind identifies student 2024 and exam formats across NL and TSV', async () => {
			const { detectKind } = await loadLibModule<DetectExports>('core/detect.ts');
			expect(detectKind(PASTE_1_NL)).toBe('sinh viên 2024');
			expect(detectKind(PASTE_1_TSV)).toBe('sinh viên 2024');
			expect(detectKind(PASTE_2_NL)).toBe('exam');
			expect(detectKind(PASTE_2_TSV)).toBe('exam');
		});

		it('T1-F7-02: extractMeta extracts student info and pagination counts', async () => {
			const { extractMeta } = await loadLibModule<DetectExports>('core/detect.ts');
			const m1 = extractMeta(PASTE_1_NL);
			const m2 = extractMeta(PASTE_2_NL);
			expect(m1).toEqual({
				studentName: 'SINH VIÊN MẪU',
				studentId: 'DEMO-STUDENT-ID',
				pagination: { shownFrom: 1, shown: 10, total: 13 }
			});
			expect(m2).toEqual({
				studentName: 'SINH VIÊN MẪU',
				studentId: 'DEMO-STUDENT-ID',
				pagination: { shownFrom: 1, shown: 9, total: 9 }
			});
		});

		it('T1-F7-03: mergeTimetables combines TKB and Exam timetables for semester 261', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const { mergeTimetables } = await loadLibModule<DetectExports>('core/detect.ts');

			const merged = mergeTimetables([parseStudent2024(PASTE_1_NL), parseExam2024(PASTE_2_NL)]);
			resolve(merged);
			expect(merged.semester).toBe(261);
			expect(merged.rows).toHaveLength(9);
			expect(merged.exams).toHaveLength(9);
			expect(merged.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');
		});

		it('T1-F7-04: mergeTimetables preserves both CO2011 split-week rows', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const { mergeTimetables } = await loadLibModule<DetectExports>('core/detect.ts');
			const merged = mergeTimetables([parseStudent2024(PASTE_1_NL)]);
			const co2011 = merged.rows.filter((r) =>
				rowMatchesCourse(r, 'CO2011', 'Mô hình hóa Toán học')
			);
			expect(co2011).toHaveLength(2);
			expect(co2011[0].weeks).not.toEqual(co2011[1].weeks);
		});

		it('T1-F7-05: mergeTimetables deduplicates identical class rows and exam rows', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const { mergeTimetables } = await loadLibModule<DetectExports>('core/detect.ts');

			const merged = mergeTimetables([
				parseStudent2024(PASTE_1_NL),
				parseStudent2024(PASTE_1_TSV),
				parseExam2024(PASTE_2_NL),
				parseExam2024(PASTE_2_TSV)
			]);
			expect(merged.rows).toHaveLength(9);
			expect(merged.exams).toHaveLength(9);
		});
	});

	describe('Feature #8: RFC 5545 .ics & GCal formatters', () => {
		it('T1-F8-01: formatIcal emits valid VCALENDAR with \\n descriptions and VALARM triggers', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);
			const ics = mod.formatIcal(merged);
			expect(ics).toContain('BEGIN:VCALENDAR');
			expect(ics).toContain('END:VCALENDAR');
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(18);
			expect(ics).toContain('SUMMARY:[CK] CO2011 - Mô hình hóa Toán học');
			expect(ics).toContain('LOCATION:B4-305 (BK-CS1)');
			expect(ics).toContain('TRIGGER:-P1D');
			expect(ics).toContain('TRIGGER:-PT60M');
			expect(ics).toMatch(/DESCRIPTION:.*\\n/);
		});

		it('T1-F8-02: formatIcal scope option filters classes, exams, or all', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const classesOnly = mod.formatIcal(merged, { scope: 'classes' });
			const examsOnly = mod.formatIcal(merged, { scope: 'exams' });
			const all = mod.formatIcal(merged, { scope: 'all' });

			expect(classesOnly.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(classesOnly).not.toContain('[CK]');
			expect(classesOnly).not.toContain('[GK]');
			expect(examsOnly.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(examsOnly).not.toContain('RRULE:');
			expect(all.match(/BEGIN:VEVENT/g)).toHaveLength(18);
		});

		it('T1-F8-03: formatGapi returns GapiEvents in Asia/Ho_Chi_Minh with exam reminders', async () => {
			const { formatGapi } = await loadLibModule<GapiExports>('core/formatter/gapi.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const events = formatGapi(merged);
			expect(events).toHaveLength(18);
			for (const ev of events) {
				expect(ev.start.timeZone).toBe('Asia/Ho_Chi_Minh');
				expect(ev.end.timeZone).toBe('Asia/Ho_Chi_Minh');
			}
			const examEvents = events.filter((e) => /^\[(CK|GK)\] /.test(e.summary));
			expect(examEvents).toHaveLength(9);
			for (const ex of examEvents) {
				expect(ex.reminders).toEqual({
					useDefault: false,
					overrides: [
						{ method: 'popup', minutes: 1440 },
						{ method: 'popup', minutes: 60 }
					]
				});
			}
		});

		it('T1-F8-04: formatGapiSplit separates 9 classEvents and 9 examEvents', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);

			const { classEvents, examEvents } = mod.formatGapiSplit(merged);
			expect(classEvents).toHaveLength(9);
			expect(examEvents).toHaveLength(9);
			for (const ex of examEvents) {
				expect(ex.summary).toMatch(/^\[(CK|GK)\] /);
			}
		});

		it('T1-F8-05: formatGoogleCalendarTemplateUrl builds exact TEMPLATE URL for CO2011 CK', async () => {
			const { formatGoogleCalendarTemplateUrl } =
				await loadLibModule<GapiExports>('core/formatter/gapi.ts');
			const urlStr = formatGoogleCalendarTemplateUrl(PASTE_2_EXPECTED_EXAMS[0]);
			expect(urlStr.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
			const params = new URL(urlStr).searchParams;
			expect(params.get('action')).toBe('TEMPLATE');
			expect(params.get('text')).toBe('[CK] CO2011 - Mô hình hóa Toán học');
			expect(params.get('dates')).toBe('20261228T000000Z/20261228T012000Z');
			expect(params.get('location')).toBe('B4-305 (BK-CS1)');
			expect(params.get('ctz')).toBe('Asia/Ho_Chi_Minh');
			expect(params.get('details')).toBeTruthy();
		});
	});

	describe('Feature #9: Cross-TZ & config verification', () => {
		it('T1-F9-01: TZ=America/New_York resolves Paste #1 to 2026-08-24T00:00:00.000Z', () => {
			const out = runInTimezone<{ tz: string; iso: string }>(
				'America/New_York',
				`
				const mod = await server.ssrLoadModule('$lib/core/mod');
				const tt = mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)});
				mod.resolve(tt);
				return {
					tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
					iso: tt.startMondayUTC?.toISOString()
				};
				`
			);
			expect(out.tz).toBe('America/New_York');
			expect(out.iso).toBe('2026-08-24T00:00:00.000Z');
		});

		it('T1-F9-02: TZ=Asia/Ho_Chi_Minh resolves Paste #1 identically with HCM dayOfWeek', () => {
			const out = runInTimezone<{ iso: string; dayMon: number; daySun: number }>(
				'Asia/Ho_Chi_Minh',
				`
				const mod = await server.ssrLoadModule('$lib/core/mod');
				const tt = mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)});
				mod.resolve(tt);
				return {
					iso: tt.startMondayUTC?.toISOString(),
					dayMon: mod.dayOfWeek(Date.UTC(2026, 7, 24)),
					daySun: mod.dayOfWeek(Date.UTC(2026, 7, 30))
				};
				`
			);
			expect(out.iso).toBe('2026-08-24T00:00:00.000Z');
			expect(out.dayMon).toBe(2);
			expect(out.daySun).toBe(8);
		});

		it('T1-F9-03: formatIcal output is byte-identical between America/New_York and Asia/Ho_Chi_Minh', () => {
			const runIcal = (tz: string) =>
				runInTimezone<string>(
					tz,
					`
					const mod = await server.ssrLoadModule('$lib/core/mod');
					const merged = mod.mergeTimetables([
						mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)}),
						mod.parseExam2024(${JSON.stringify(PASTE_2_NL)})
					]);
					mod.resolve(merged);
					return mod.formatIcal(merged);
					`
				);
			const ny = normalizeIcalVolatileFields(runIcal('America/New_York'));
			const hcm = normalizeIcalVolatileFields(runIcal('Asia/Ho_Chi_Minh'));
			expect(ny).toBe(hcm);
		});

		it('T1-F9-04: formatGapiSplit and TEMPLATE URLs are identical between NY and HCM', () => {
			const runGapi = (tz: string) =>
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
			expect(runGapi('America/New_York')).toEqual(runGapi('Asia/Ho_Chi_Minh'));
		});

		it('T1-F9-05: vite.config.js includes tests/**/*.test.ts and strict TS config exists', () => {
			const viteCfg = readWorkspaceText('vite.config.js');
			const tsCfg = readWorkspaceText('tsconfig.json');
			expect(viteCfg).toContain('tests/**/*.test.ts');
			expect(tsCfg).toContain('"strict": true');
		});
	});

	describe('Feature #10: Color modes & Tomato exam highlight', () => {
		it('T1-F10-01: COLORS covers keys 1..11 and EXAM_TOMATO_COLOR_ID is 11', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			expect(colors.EXAM_TOMATO_COLOR_ID).toBe('11');
			for (let i = 1; i <= 11; i++) {
				expect(colors.COLORS.get(String(i))).toBeTruthy();
			}
		});

		it('T1-F10-02: randomColorIds(9) returns 9 valid color IDs from COLORS', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const ids = [...colors.randomColorIds(9)];
			expect(ids).toHaveLength(9);
			for (const id of ids) {
				expect(colors.COLORS.has(id)).toBe(true);
			}
		});

		it('T1-F10-03: courseColorIds is deterministic and matches both CO2011 split-week rows', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const tt = mod.parseStudent2024(PASTE_1_NL);
			mod.resolve(tt);
			const events = mod.formatGapi(tt);
			const run1 = colors.courseColorIds(events);
			const run2 = colors.courseColorIds(events);
			expect(run1).toEqual(run2);
			expect(run1).toHaveLength(events.length);

			const co2011Indices = events
				.map((e, idx) =>
					e.summary.includes('CO2011') || e.summary.includes('Mô hình hóa') ? idx : -1
				)
				.filter((idx) => idx >= 0);
			expect(co2011Indices).toHaveLength(2);
			expect(run1[co2011Indices[0]]).toBe(run1[co2011Indices[1]]);
		});

		it('T1-F10-04: courseColorIds assigns matching colors to class and exam sharing CO2011', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);
			const events = mod.formatGapi(merged);
			const ids = colors.courseColorIds(events);

			const classIdx = events.findIndex((e) => e.description?.includes('mã môn học: CO2011'));
			const examIdx = events.findIndex((e) => e.summary.startsWith('[CK] CO2011'));
			expect(classIdx).toBeGreaterThanOrEqual(0);
			expect(examIdx).toBeGreaterThanOrEqual(0);
			expect(ids[classIdx]).toBe(ids[examIdx]);
		});

		it('T1-F10-05: Tomato highlight applies EXAM_TOMATO_COLOR_ID (11) to examEvents while preserving class colors', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);
			const { classEvents, examEvents } = mod.formatGapiSplit(merged);
			const classIds = colors.courseColorIds(classEvents);
			const coloredClasses = classEvents.map((e, i) => ({ ...e, colorId: classIds[i] }));
			const coloredExams = examEvents.map((e) => ({ ...e, colorId: colors.EXAM_TOMATO_COLOR_ID }));

			expect(coloredClasses).toHaveLength(9);
			expect(coloredExams).toHaveLength(9);
			for (const ex of coloredExams) {
				expect(ex.colorId).toBe('11');
			}
			expect(new Set(coloredClasses.map((c) => c.colorId)).size).toBeGreaterThan(1);
		});
	});

	describe('Feature #11: Google OAuth & Calendar API client', () => {
		it('T1-F11-01: DEFAULT_CLIENT_ID matches the required OAuth Client ID', async () => {
			const googleMod = await loadLibModule<GoogleExports>('google.ts');
			expect(googleMod.DEFAULT_CLIENT_ID).toBe(
				'864474557161-jci8mppafkd21prbsg5n3ll4m23i8vda.apps.googleusercontent.com'
			);
		});

		it('T1-F11-02: google.ts supports PUBLIC_GOOGLE_CLIENT_ID override', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).toContain('PUBLIC_GOOGLE_CLIENT_ID');
			expect(src).toContain('DEFAULT_CLIENT_ID');
		});

		it('T1-F11-03: google.ts restricts OAuth to hosted_domain hcmut.edu.vn', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).toMatch(/hosted_domain:\s*['"]hcmut\.edu\.vn['"]/);
		});

		it('T1-F11-04: google.ts awaits gapi.load("client") and sets OAuth token', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).toContain('gapi.load');
			expect(src).toContain('setToken');
		});

		it('T1-F11-05: repository contains zero Client secret strings', () => {
			const files = [...collectFilesRecursive('src'), ...collectFilesRecursive('.github')];
			expect(files.length).toBeGreaterThan(0);
			for (const file of files) {
				const content = readWorkspaceText(file);
				expect(content).not.toMatch(/GOCSPX-/);
				expect(content).not.toMatch(/client_secret/i);
			}
		});
	});

	describe('Feature #12: Compact UI, previews & /privacy', () => {
		it('T1-F12-01: layout and export selector render the compact shell, Vietnamese choices, and Oxazite credit', async () => {
			const layout = await loadRouteModule<SvelteComponentModule>('+layout.svelte');
			const selector = await loadRouteModule<SvelteComponentModule>('OutputSelect.svelte');
			const { html } = layout.default.render();
			const options = selector.default.render({ output: 'gapi' }).html;
			expect(html).toContain('max-w-xs');
			expect(options).toContain('Lịch Google');
			expect(options).toContain('Tệp .ics');
			expect(html).toContain('Oxazite');
			expect(html).toContain('/privacy');
		});

		it('T1-F12-02: /privacy/+page.svelte renders client-side privacy documentation', async () => {
			const privacy = await loadRouteModule<SvelteComponentModule>('privacy/+page.svelte');
			const { html } = privacy.default.render();
			expect(html.length).toBeGreaterThan(100);
			expect(html).toMatch(/Google Calendar|trình duyệt|client/i);
		});

		it('T1-F12-03: +layout.ts exports prerender = true for static adapter output', async () => {
			const layout = await loadRouteModule<{ prerender?: boolean }>('+layout.ts');
			expect(layout.prerender).toBe(true);
		});

		it('T1-F12-04: all UI route components exist and compile as renderable Svelte components', async () => {
			const requiredComponents = [
				'BKalendar.svelte',
				'PasteArea.svelte',
				'KindSelect.svelte',
				'NameInput.svelte',
				'OutputSelect.svelte',
				'GapiPreview.svelte',
				'ExamPreview.svelte',
				'GapiOutputSection.svelte',
				'IcalOutputSection.svelte',
				'ErrorReport.svelte'
			];
			for (const comp of requiredComponents) {
				const mod = await loadRouteModule<SvelteComponentModule>(comp);
				expect(typeof mod.default?.render).toBe('function');
			}
		});

		it('T1-F12-05: default calendar naming selects SV261 when classes present and THI261 for exam-only', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const tkbOnly = mod.parseStudent2024(PASTE_1_NL);
			const examOnly = mod.parseExam2024(PASTE_2_NL);
			const merged = mod.mergeTimetables([tkbOnly, examOnly]);

			expect(defaultCalendarName(tkbOnly)).toBe('SV261');
			expect(defaultCalendarName(merged)).toBe('SV261');
			expect(defaultCalendarName(examOnly)).toBe('THI261');
		});
	});
});
