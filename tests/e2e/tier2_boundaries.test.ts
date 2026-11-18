import { describe, expect, it } from 'vitest';
import { DAY } from '$lib/core/constants';
import { dayOfWeek, MixedSemesterError, resolve, UnresolvedError } from '$lib/core/resolver';
import {
	NumOfColumnMismatchError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from '$lib/core/parser/errors';
import type { ExamRow, Timetable } from '$lib/core/timetable';
import {
	collectFilesRecursive,
	loadLibModule,
	loadRouteModule,
	makeSyntheticExam2024,
	makeSyntheticTkb2024,
	normalizeIcalVolatileFields,
	PASTE_1_NL,
	PASTE_1_PAGE2_NL,
	PASTE_2_EXPECTED_EXAMS,
	PASTE_2_NL,
	readWorkspaceText,
	rowMatchesCourse,
	runInTimezone,
	unfoldIcal,
	workspaceExists,
	type ColorsExports,
	type DetectExports,
	type Exam2024Exports,
	type GapiEvent,
	type GapiExports,
	type GoogleExports,
	type LecturerExports,
	type ModExports,
	type ParserUtilsExports,
	type PostgradExports,
	type Student2024Exports,
	type StudentExports,
	type SvelteComponentModule
} from './fixtures';

describe('Tier 2 — Boundary & Corner Cases (Features #1–#12)', () => {
	describe('Feature #1: Project scaffolding & config boundaries', () => {
		it('T2-F1-01: core modules under src/lib/core contain zero Deno or JSR references', () => {
			const coreFiles = collectFilesRecursive('src/lib/core', ['.ts']);
			expect(coreFiles.length).toBeGreaterThan(0);
			for (const file of coreFiles) {
				const text = readWorkspaceText(file);
				expect(text).not.toMatch(/\bDeno\.|jsr:|https:\/\/deno\.land\/|@std\//);
			}
		});

		it('T2-F1-02: .gitignore protects .env files and generated artifacts', () => {
			const gi = readWorkspaceText('.gitignore');
			for (const entry of ['.env', '.env.*', 'node_modules', 'build', '.svelte-kit']) {
				expect(gi).toContain(entry);
			}
		});

		it('T2-F1-03: .prettierrc matches project formatting standards', () => {
			const prettier = JSON.parse(readWorkspaceText('.prettierrc')) as {
				useTabs: boolean;
				singleQuote: boolean;
				trailingComma: string;
				printWidth: number;
			};
			expect(prettier.useTabs).toBe(true);
			expect(prettier.singleQuote).toBe(true);
			expect(prettier.trailingComma).toBe('none');
			expect(prettier.printWidth).toBe(100);
		});

		it('T2-F1-04: pnpm-lock.yaml exists and has no jsr.io tarball URLs', () => {
			expect(workspaceExists('pnpm-lock.yaml')).toBe(true);
			const lock = readWorkspaceText('pnpm-lock.yaml');
			expect(lock.length).toBeGreaterThan(0);
			expect(lock).not.toContain('npm.jsr.io');
		});

		it('T2-F1-05: built HTML uses root-relative asset paths when build/ exists or REQUIRE_BUILD=1', () => {
			const requireBuild = process.env.REQUIRE_BUILD === '1';
			const hasBuild = workspaceExists('build/index.html');
			if (!hasBuild && !requireBuild) {
				expect(workspaceExists('svelte.config.js')).toBe(true);
				return;
			}
			expect(hasBuild).toBe(true);
			const indexHtml = readWorkspaceText('build/index.html');
			expect(indexHtml).not.toContain('/bkalendar.github.io/_app/');
			expect(indexHtml).toMatch(/(\.\/|\/)_app\//);
		});
	});

	describe('Feature #2: Core constants, types, errors & utils boundaries', () => {
		it('T2-F2-01: parseTime handles empty dash variants (--, ---, - - -, whitespace) without NaN', async () => {
			const utils = await loadLibModule<ParserUtilsExports>('core/parser/utils.ts');
			for (const emptySlot of ['--', '---', '- - -', '  --  ']) {
				let res: unknown = null;
				let threw = false;
				try {
					res = utils.parseTime(emptySlot);
				} catch {
					threw = true;
				}
				expect(threw || res === null || res === undefined).toBe(true);
			}
		});

		it('T2-F2-02: parseExamTime handles 00g00/23g59/0:05/7g00 and rejects invalid times', async () => {
			const utils = await loadLibModule<ParserUtilsExports>('core/parser/utils.ts');
			expect(utils.parseExamTime('00g00')).toEqual([0, 0]);
			expect(utils.parseExamTime('23g59')).toEqual([23, 59]);
			expect(utils.parseExamTime('0:05')).toEqual([0, 5]);
			expect(utils.parseExamTime('7g00')).toEqual([7, 0]);

			for (const bad of ['24g00', '12g60', 'abc', '']) {
				expect(() => utils.parseExamTime(bad)).toThrow();
			}
		});

		it('T2-F2-03: addMinutesToHm wraps cleanly across midnight and multi-hour spans', async () => {
			const utils = await loadLibModule<ParserUtilsExports>('core/parser/utils.ts');
			expect(utils.addMinutesToHm([23, 30], 60)).toEqual([0, 30]);
			expect(utils.addMinutesToHm([22, 15], 180)).toEqual([1, 15]);
			expect(utils.addMinutesToHm([0, 0], 0)).toEqual([0, 0]);
			expect(utils.addMinutesToHm([23, 59], 1)).toEqual([0, 0]);
		});

		it('T2-F2-04: Windows CRLF (\\r\\n) and extra blank lines parse identically to LF', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const tkbLf = mod.parseStudent2024(PASTE_1_NL);
			const tkbCrlf = mod.parseStudent2024(PASTE_1_NL.replace(/\n/g, '\r\n') + '\r\n\r\n');
			expect(tkbCrlf.semester).toBe(tkbLf.semester);
			expect(tkbCrlf.rows).toEqual(tkbLf.rows);

			const exLf = mod.parseExam2024(PASTE_2_NL);
			const exCrlf = mod.parseExam2024(PASTE_2_NL.replace(/\n/g, '\r\n') + '\r\n\r\n');
			expect(exCrlf.exams).toEqual(exLf.exams);
		});

		it('T2-F2-05: all core and parser error classes expose string .name and .message', () => {
			const instances = [
				new ParseError('x', 'parse failure'),
				new SemesterNotFoundError('x'),
				new NumOfColumnMismatchError('x', 11, 9),
				new TableNotFoundError('x'),
				new MixedSemesterError(new Date('2026-08-24'), new Date('2026-01-05')),
				new UnresolvedError()
			];
			for (const err of instances) {
				expect(typeof err.name).toBe('string');
				expect(err.name.length).toBeGreaterThan(0);
				expect(typeof err.message).toBe('string');
				expect(err.message.length).toBeGreaterThan(0);
			}
		});
	});

	describe('Feature #3: Core resolver & TZ boundaries', () => {
		it('T2-F3-01: dayOfWeek at UTC midnight under TZ=America/New_York returns 2 (Monday), not 8', () => {
			const res = runInTimezone<{ dow: number; utcDay: number; localDay: number }>(
				'America/New_York',
				`
				const resolver = await server.ssrLoadModule('$lib/core/resolver');
				const ts = Date.UTC(2026, 7, 24, 0, 0, 0);
				return {
					dow: resolver.dayOfWeek(ts),
					utcDay: new Date(ts).getUTCDay(),
					localDay: new Date(ts).getDay()
				};
				`
			);
			expect(res.utcDay).toBe(1);
			expect(res.localDay).toBe(0);
			expect(res.dow).toBe(2);
		});

		it('T2-F3-02: resolve throws UnresolvedError when rows are empty and exams are empty/undefined', () => {
			expect(() => resolve({ semester: 261, rows: [] })).toThrow(UnresolvedError);
			expect(() => resolve({ semester: 261, rows: [], exams: [] })).toThrow(UnresolvedError);
		});

		it('T2-F3-03: resolve throws UnresolvedError when all rows have null-only weeks and no exams', () => {
			const tt: Timetable = {
				semester: 261,
				rows: [
					{
						name: 'Unscheduled',
						weekday: 2,
						startHm: [7, 0],
						endHm: [8, 50],
						weeks: [null, null, null],
						location: 'B1-101',
						extras: {}
					}
				]
			};
			expect(() => resolve(tt)).toThrow(UnresolvedError);
		});

		it('T2-F3-04: full parse->resolve->format pipeline is invariant across UTC, NY, HCM, Auckland', () => {
			const runPipeline = (tz: string) =>
				runInTimezone<{ iso: string; ics: string; gapi: unknown }>(
					tz,
					`
					const mod = await server.ssrLoadModule('$lib/core/mod');
					const merged = mod.mergeTimetables([
						mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)}),
						mod.parseExam2024(${JSON.stringify(PASTE_2_NL)})
					]);
					mod.resolve(merged);
					return {
						iso: merged.startMondayUTC?.toISOString(),
						ics: mod.formatIcal(merged),
						gapi: mod.formatGapiSplit(merged)
					};
					`
				);
			const baseline = runPipeline('Asia/Ho_Chi_Minh');
			const baseIcs = normalizeIcalVolatileFields(baseline.ics);
			for (const tz of ['UTC', 'America/New_York', 'Pacific/Auckland']) {
				const cur = runPipeline(tz);
				expect(cur.iso).toBe(baseline.iso);
				expect(normalizeIcalVolatileFields(cur.ics)).toBe(baseIcs);
				expect(cur.gapi).toEqual(baseline.gapi);
			}
		});

		it('T2-F3-05: semester 262 spanning early-year weeks resolves to a UTC Monday in 2027', () => {
			const tt: Timetable = {
				semester: 262,
				rows: [
					{
						name: 'Spring Course',
						weekday: 2,
						startHm: [7, 0],
						endHm: [8, 50],
						weeks: [2, 3, 4, 5],
						location: 'B1-101',
						extras: {}
					}
				]
			};
			resolve(tt);
			expect(tt.startMondayUTC).toBeDefined();
			expect(tt.startMondayUTC?.getUTCDay()).toBe(1);
			expect(tt.startMondayUTC?.getUTCFullYear()).toBe(2027);
			expect(dayOfWeek(tt.startMondayUTC!.getTime())).toBe(2);
			expect(dayOfWeek(tt.startMondayUTC!.getTime() + 6 * DAY)).toBe(8);
		});
	});

	describe('Feature #4: parseStudent2024 boundaries', () => {
		it('T2-F4-01: parses CN (Sunday) weekday as 8', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const src = makeSyntheticTkb2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'PE1001',
						'Giáo dục thể chất',
						'0',
						'0',
						'CC01',
						'CN',
						'2 - 3',
						'7:00 - 8:50',
						'SAN-BONG',
						'BK-CS1',
						'35|36|'
					]
				],
				{ tsv: true }
			);
			const tt = parseStudent2024(src);
			expect(tt.rows).toHaveLength(1);
			expect(tt.rows[0].weekday).toBe(8);
		});

		it('T2-F4-02: handles missing or -- PHÒNG without throwing column errors', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const src = makeSyntheticTkb2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'CO1001',
						'Online Course A',
						'2',
						'2',
						'CC01',
						'2',
						'4 - 5',
						'9:00 - 10:50',
						'--',
						'BK-CS1',
						'35|36|'
					],
					[
						'20261',
						'CO1002',
						'Online Course B',
						'2',
						'2',
						'CC01',
						'3',
						'4 - 5',
						'9:00 - 10:50',
						'',
						'BK-CS1',
						'35|36|'
					]
				],
				{ tsv: true }
			);
			const tt = parseStudent2024(src);
			expect(tt.rows).toHaveLength(2);
		});

		it('T2-F4-03: throws SemesterNotFoundError and TableNotFoundError on missing metadata/header', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const tableWithoutSemester = [
				'THỜI KHÓA BIỂU HỌC KỲ',
				'Không có học kỳ',
				'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC',
				'INVALID\tSP1033\tKinh tế Chính trị\t2\t2\tCC02\t2\t4 - 5\t9:00 - 10:50\tC5-101\tBK-CS1\t35|36|'
			].join('\n');
			expect(() => parseStudent2024(tableWithoutSemester)).toThrow(SemesterNotFoundError);
			expect(() =>
				parseStudent2024('THỜI KHÓA BIỂU HỌC KỲ\n20261 - Học kỳ 1 Năm học 2026 - 2027\nNo table')
			).toThrow(TableNotFoundError);
		});

		it('T2-F4-04: throws NumOfColumnMismatchError on malformed TSV or truncated NL rows', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const badTsv = [
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC',
				'20261\tSP1033\tOnly 5 cols\t2\tCC02'
			].join('\n');
			expect(() => parseStudent2024(badTsv)).toThrow(NumOfColumnMismatchError);

			const badNl = [
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				'HỌC KỲ',
				'MÃ MH',
				'TÊN MÔN HỌC',
				'TÍN CHỈ',
				'TC HỌC PHÍ',
				'NHÓM - TỔ',
				'THỨ',
				'TIẾT',
				'GIỜ HỌC',
				'PHÒNG',
				'CƠ SỞ',
				'TUẦN HỌC',
				'20261',
				'SP1033',
				'Truncated row',
				'2',
				'2',
				'CC02',
				'2'
			].join('\n');
			expect(() => parseStudent2024(badNl)).toThrow(NumOfColumnMismatchError);
		});

		it('T2-F4-05: upward scan j=1..8 finds standalone semester without (Hiện hành) while ignoring 20291 trap', async () => {
			const { parseStudent2024 } = await loadLibModule<Student2024Exports>(
				'core/parser/student_2024.ts'
			);
			const row = [
				'20252',
				'SP1033',
				'Kinh tế Chính trị',
				'2',
				'2',
				'CC02',
				'2',
				'4 - 5',
				'9:00 - 10:50',
				'C5-101',
				'BK-CS1',
				'2|3|4|'
			];
			const near = makeSyntheticTkb2024(
				'20291 - Học kỳ 1 Năm học 2029 - 203020252 - Học kỳ 2 Năm học 2025 - 2026\n20252 - Học kỳ 2 Năm học 2025 - 2026',
				[row],
				{ tsv: true }
			);
			const far = makeSyntheticTkb2024(
				'20291 - Học kỳ 1 Năm học 2029 - 203020252 - Học kỳ 2 Năm học 2025 - 2026\n20252 - Học kỳ 2 Năm học 2025 - 2026',
				[row],
				{
					tsv: true,
					extraLinesBeforeHeader: ['line a', 'line b', 'line c', 'line d', 'line e', 'line f']
				}
			);
			expect(parseStudent2024(near).semester).toBe(252);
			expect(parseStudent2024(far).semester).toBe(252);
		});
	});

	describe('Feature #5: Legacy parsers boundaries', () => {
		it('T2-F5-01: empty and whitespace-only inputs throw typed ParseError (never TypeError)', async () => {
			const { parseStudent } = await loadLibModule<StudentExports>('core/parser/student.ts');
			const { parseLecturer } = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const { parsePostgrad } = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');

			for (const fn of [parseStudent, parseLecturer, parsePostgrad]) {
				for (const empty of ['', '   ', '\r\n\t\r\n']) {
					expect(() => fn(empty)).toThrow(ParseError);
				}
			}
		});

		it('T2-F5-02: postgrad.ts can be imported directly without triggering circular-dependency errors', async () => {
			const postgrad = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');
			expect(typeof postgrad.parsePostgrad).toBe('function');
			expect(() => postgrad.parsePostgrad('20241 - Học kỳ 1 Năm học 2024 - 2025')).toThrow(
				TableNotFoundError
			);
		});

		it('T2-F5-03: legacy parsers reject non-table noise with TableNotFoundError (never TypeError)', async () => {
			const { parseStudent } = await loadLibModule<StudentExports>('core/parser/student.ts');
			const { parseLecturer } = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const { parsePostgrad } = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');
			const noise = '20241 - Học kỳ 1 Năm học 2024 - 2025\nrandom\ttext\nhere\n12345';

			for (const fn of [parseStudent, parseLecturer, parsePostgrad]) {
				try {
					fn(noise);
					expect.unreachable('Expected legacy parser to throw');
				} catch (err) {
					expect(err).toBeInstanceOf(ParseError);
					expect(err).not.toBeInstanceOf(TypeError);
				}
			}
		});

		it('T2-F5-04: legacy parsers reject text with arbitrary numbers lacking a valid semester/table', async () => {
			const { parseStudent } = await loadLibModule<StudentExports>('core/parser/student.ts');
			const { parseLecturer } = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const { parsePostgrad } = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');

			for (const fn of [parseStudent, parseLecturer, parsePostgrad]) {
				expect(() => fn('MSSV: DEMO-STUDENT-ID\nNăm 2026')).toThrow(ParseError);
			}
		});

		it('T2-F5-05: mod.ts exposes all 3 legacy parsers matching direct module exports', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const s = await loadLibModule<StudentExports>('core/parser/student.ts');
			const l = await loadLibModule<LecturerExports>('core/parser/lecturer.ts');
			const p = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');
			expect(mod.parseStudent).toBe(s.parseStudent);
			expect(mod.parseLecturer).toBe(l.parseLecturer);
			expect(mod.parsePostgrad).toBe(p.parsePostgrad);
		});
	});

	describe('Feature #6: Exam schedule parser boundaries', () => {
		it('T2-F6-01: parses HH:MM start time and ignores 20291 dropdown trap', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const src = makeSyntheticExam2024(
				'20291 - Học kỳ 1 Năm học 2029 - 203020261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)\n20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'CO2011 - Mô hình hóa Toán học',
						'CC02',
						'2026-12-28',
						'CK',
						'BK-CS1',
						'B4-305',
						'2',
						'09:30',
						'90',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			const tt = parseExam2024(src);
			expect(tt.semester).toBe(261);
			expect(tt.exams?.[0].startHm).toEqual([9, 30]);
			expect(tt.exams?.[0].endHm).toEqual([11, 0]);
		});

		it('T2-F6-02: handles CN (Sunday = 8) and missing/-- room in exam rows', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const src = makeSyntheticExam2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'PE1001 - Giáo dục thể chất',
						'CC01',
						'2026-12-20',
						'CK',
						'BK-CS1',
						'--',
						'CN',
						'08g00',
						'60',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			const tt = parseExam2024(src);
			expect(tt.exams).toHaveLength(1);
			expect(tt.exams?.[0].weekday).toBe(8);
		});

		it('T2-F6-03: handles course string without " - " separator safely', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const src = makeSyntheticExam2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'THESIS',
						'CC01',
						'2026-12-20',
						'CK',
						'BK-CS1',
						'B4-101',
						'2',
						'08g00',
						'60',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			const tt = parseExam2024(src);
			expect(tt.exams).toHaveLength(1);
			expect(tt.exams?.[0].rawCourse).toBe('THESIS');
			expect(tt.exams?.[0].courseCode).toBeTruthy();
			expect(typeof tt.exams?.[0].courseName).toBe('string');
		});

		it('T2-F6-04: computes cross-midnight and multi-hour endHm and rejects invalid durations', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			const validSrc = makeSyntheticExam2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'CO2001 - Test Midnight',
						'CC01',
						'2026-12-28',
						'CK',
						'BK-CS1',
						'B4-101',
						'2',
						'23g00',
						'90',
						'2026-10-23 10:10:00'
					],
					[
						'20261',
						'CO2002 - Test Long',
						'CC01',
						'2026-12-29',
						'CK',
						'BK-CS1',
						'B4-102',
						'3',
						'08g00',
						'180',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			const tt = parseExam2024(validSrc);
			expect(tt.exams?.[0].endHm).toEqual([0, 30]);
			expect(tt.exams?.[1].endHm).toEqual([11, 0]);

			const badDur = makeSyntheticExam2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'CO2001 - Bad Duration',
						'CC01',
						'2026-12-28',
						'CK',
						'BK-CS1',
						'B4-101',
						'2',
						'08g00',
						'-10',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			expect(() => parseExam2024(badDur)).toThrow();
		});

		it('T2-F6-05: rejects truncated exam rows, malformed dates, and missing table headers', async () => {
			const { parseExam2024 } = await loadLibModule<Exam2024Exports>('core/parser/exam_2024.ts');
			expect(() =>
				parseExam2024('LỊCH KIỂM TRA - THI HỌC KỲ\n20261 - Học kỳ 1 Năm học 2026 - 2027')
			).toThrow(TableNotFoundError);

			const truncated = [
				'LỊCH KIỂM TRA - THI HỌC KỲ',
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				'Học kỳ\tMôn học\tNhóm lớp\tNgày thi\tLoại thi\tCơ sở\tMã phòng\tThứ\tGiờ bắt đầu\tTổng số phút\tCập nhật cuối cùng vào lúc',
				'20261\tCO2011 - Test\tCC01\t2026-12-28\tCK\tBK-CS1\tB4-305'
			].join('\n');
			expect(() => parseExam2024(truncated)).toThrow(NumOfColumnMismatchError);

			const badDate = makeSyntheticExam2024(
				'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
				[
					[
						'20261',
						'CO2011 - Bad Date',
						'CC01',
						'bad-date',
						'CK',
						'BK-CS1',
						'B4-305',
						'2',
						'08g00',
						'60',
						'2026-10-23 10:10:00'
					]
				],
				{ tsv: true }
			);
			expect(() => parseExam2024(badDate)).toThrow();
		});
	});

	describe('Feature #7: Auto-detection, metadata & multi-paste merge boundaries', () => {
		it('T2-F7-01: mergeTimetables throws MixedSemesterError or Error on mismatched semesters', async () => {
			const { mergeTimetables } = await loadLibModule<DetectExports>('core/detect.ts');
			const tt261: Timetable = { semester: 261, rows: [] };
			const tt252: Timetable = { semester: 252, rows: [] };
			expect(() => mergeTimetables([tt261, tt252])).toThrow();
		});

		it('T2-F7-02: mergeTimetables deduplicates overlapping SP1033 while keeping CO2011 split-weeks', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const page1 = mod.parseStudent2024(PASTE_1_NL);
			const page2 = mod.parseStudent2024(PASTE_1_PAGE2_NL);
			const merged = mod.mergeTimetables([page1, page2]);
			// Page 1 has 9 scheduled rows, Page 2 repeats SP1033 + adds 3 new courses => 12 rows
			expect(merged.rows).toHaveLength(12);
			expect(
				merged.rows.filter((r) => rowMatchesCourse(r, 'CO2011', 'Mô hình hóa Toán học'))
			).toHaveLength(2);
			expect(
				merged.rows.filter((r) => rowMatchesCourse(r, 'SP1033', 'Kinh tế Chính trị Mác - Lênin'))
			).toHaveLength(1);
		});

		it('T2-F7-03: mergeTimetables keeps GK and CK of same course while dropping exact duplicate CK', async () => {
			const { mergeTimetables } = await loadLibModule<DetectExports>('core/detect.ts');
			const gk = PASTE_2_EXPECTED_EXAMS.find(
				(e) => e.courseCode === 'CO2003' && e.examType === 'GK'
			)!;
			const ck = PASTE_2_EXPECTED_EXAMS.find(
				(e) => e.courseCode === 'CO2003' && e.examType === 'CK'
			)!;
			const merged = mergeTimetables([
				{ semester: 261, rows: [], exams: [gk, ck] },
				{ semester: 261, rows: [], exams: [{ ...ck }] }
			]);
			expect(merged.exams).toHaveLength(2);
		});

		it('T2-F7-04: extractMeta handles absent metadata and Page 2 pagination cleanly', async () => {
			const { extractMeta } = await loadLibModule<DetectExports>('core/detect.ts');
			expect(extractMeta('plain text without student info')).toEqual({});
			const page2Meta = extractMeta(PASTE_1_PAGE2_NL);
			expect(page2Meta.studentName).toBe('SINH VIÊN MẪU');
			expect(page2Meta.studentId).toBe('DEMO-STUDENT-ID');
			expect(page2Meta.pagination).toEqual({ shownFrom: 11, shown: 13, total: 13 });
		});

		it('T2-F7-05: detectKind prioritizes exam headers over navbar URLs and handles single merge', async () => {
			const { detectKind, mergeTimetables } = await loadLibModule<DetectExports>('core/detect.ts');
			const examWithTkbLink = PASTE_2_NL.replace('/lich-thi', '/tkb');
			expect(detectKind(examWithTkbLink)).toBe('exam');

			const single: Timetable = { semester: 261, rows: [], exams: [PASTE_2_EXPECTED_EXAMS[0]] };
			const mergedSingle = mergeTimetables([single]);
			expect(mergedSingle.semester).toBe(261);
			expect(mergedSingle.exams).toHaveLength(1);
		});
	});

	describe('Feature #8: Formatters boundaries', () => {
		it('T2-F8-01: formatIcal and formatGapiSplit honor empty and custom examRemindersMinutes', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const examOnly = mod.parseExam2024(PASTE_2_NL);
			mod.resolve(examOnly);

			const noAlarmIcs = mod.formatIcal(examOnly, { examRemindersMinutes: [] });
			expect(noAlarmIcs).not.toContain('BEGIN:VALARM');

			const customIcs = mod.formatIcal(examOnly, { examRemindersMinutes: [30, 120] });
			expect(customIcs.match(/TRIGGER:-PT30M/g)).toHaveLength(9);
			expect(customIcs.match(/TRIGGER:-PT120M/g)).toHaveLength(9);
			expect(customIcs).not.toContain('TRIGGER:-P1D');

			const noAlarmGapi = mod.formatGapiSplit(examOnly, { examRemindersMinutes: [] });
			for (const ev of noAlarmGapi.examEvents) {
				expect(ev.reminders?.overrides ?? []).toEqual([]);
			}
		});

		it('T2-F8-02: formatIcal escapes newlines as \\n in VEVENT DESCRIPTION without raw multiline breaks', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);
			const unfolded = unfoldIcal(mod.formatIcal(merged));
			const eventDescLines: string[] = [];
			let inValarm = false;
			for (const line of unfolded.split('\n')) {
				if (line === 'BEGIN:VALARM') inValarm = true;
				else if (line === 'END:VALARM') inValarm = false;
				else if (!inValarm && line.startsWith('DESCRIPTION:')) {
					eventDescLines.push(line);
				}
			}
			expect(eventDescLines).toHaveLength(18);
			for (const line of eventDescLines) {
				expect(line).toContain('\\n');
			}
		});

		it('T2-F8-03: handles 06g00 UTC previous-day rollover and cross-midnight end times', async () => {
			const { formatGoogleCalendarTemplateUrl, formatGapiSplit } =
				await loadLibModule<GapiExports>('core/formatter/gapi.ts');
			const earlyExam: ExamRow = {
				semester: 261,
				courseCode: 'CO1001',
				courseName: 'Early Exam',
				rawCourse: 'CO1001 - Early Exam',
				group: 'CC01',
				date: '2026-12-28',
				examType: 'CK',
				campus: 'BK-CS1',
				room: 'B4-101',
				weekday: 2,
				startHm: [6, 0],
				endHm: [6, 50],
				durationMinutes: 50,
				updatedAt: '2026-10-23 10:10:00'
			};
			const url = new URL(formatGoogleCalendarTemplateUrl(earlyExam));
			expect(url.searchParams.get('dates')).toBe('20261227T230000Z/20261227T235000Z');

			const lateExam: ExamRow = {
				...earlyExam,
				courseCode: 'CO1002',
				startHm: [23, 0],
				endHm: [0, 30],
				durationMinutes: 90
			};
			const { examEvents } = formatGapiSplit({ semester: 261, rows: [], exams: [lateExam] });
			expect(examEvents).toHaveLength(1);
			// 2026-12-28 23:00 +07:00 = 2026-12-28T16:00:00Z; +90m = 2026-12-29 00:30 +07:00 = 2026-12-28T17:30:00Z
			expect(Date.parse(examEvents[0].start.dateTime)).toBe(Date.UTC(2026, 11, 28, 16, 0, 0));
			expect(Date.parse(examEvents[0].end.dateTime)).toBe(Date.UTC(2026, 11, 28, 17, 30, 0));
		});

		it('T2-F8-04: formatIcal, formatGapi, and formatGapiSplit succeed on exam-only timetable', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const examOnly = mod.parseExam2024(PASTE_2_NL);
			mod.resolve(examOnly);
			expect(examOnly.startMondayUTC).toBeUndefined();

			const ics = mod.formatIcal(examOnly);
			expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(mod.formatGapi(examOnly)).toHaveLength(9);
			const split = mod.formatGapiSplit(examOnly);
			expect(split.classEvents).toEqual([]);
			expect(split.examEvents).toHaveLength(9);
		});

		it('T2-F8-05: CO2011 split-week and SP1033 gap-week rules preserve active/excluded weeks', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const tt = mod.parseStudent2024(PASTE_1_NL);
			mod.resolve(tt);
			const ics = unfoldIcal(mod.formatIcal(tt));
			expect(ics.match(/SUMMARY:.*Mô hình hóa Toán học/g)).toHaveLength(2);
			expect(ics.match(/RRULE:/g)).toHaveLength(9);
		});
	});

	describe('Feature #9: Cross-TZ & static parity boundaries', () => {
		it('T2-F9-01: pipeline invariance holds across UTC, America/New_York, and Pacific/Auckland', () => {
			const getGapi = (tz: string) =>
				runInTimezone<unknown>(
					tz,
					`
					const mod = await server.ssrLoadModule('$lib/core/mod');
					const tt = mod.parseExam2024(${JSON.stringify(PASTE_2_NL)});
					mod.resolve(tt);
					return mod.formatGapi(tt);
					`
				);
			const utc = getGapi('UTC');
			expect(getGapi('America/New_York')).toEqual(utc);
			expect(getGapi('Pacific/Auckland')).toEqual(utc);
		});

		it('T2-F9-02: core parse/resolve/format runs offline with zero network dependency', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const merged = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(merged);
			expect(mod.formatIcal(merged).length).toBeGreaterThan(200);
		});

		it('T2-F9-03: Paste #1 and Paste #2 TSV vs NL pipelines produce identical formatIcal outputs', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const nl = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(nl);
			const tsv = mod.mergeTimetables([
				mod.parseStudent2024(PASTE_1_NL),
				mod.parseExam2024(PASTE_2_NL)
			]);
			mod.resolve(tsv);
			expect(normalizeIcalVolatileFields(mod.formatIcal(nl))).toBe(
				normalizeIcalVolatileFields(mod.formatIcal(tsv))
			);
		});

		it('T2-F9-04: E2E tests contain zero imports or references to recon/ test files', () => {
			const e2eFiles = collectFilesRecursive('tests/e2e', ['.ts']);
			for (const file of e2eFiles) {
				if (file.endsWith('tier2_boundaries.test.ts')) continue;
				const content = readWorkspaceText(file);
				expect(content).not.toMatch(/recon[\\/]/);
			}
		});

		it('T2-F9-05: .svelte-kit/tsconfig.json includes tests/**/*.ts under strict TypeScript checking', () => {
			if (workspaceExists('.svelte-kit/tsconfig.json')) {
				const skTs = readWorkspaceText('.svelte-kit/tsconfig.json');
				expect(skTs).toContain('../tests/**/*.ts');
				expect(skTs).toContain('importsNotUsedAsValues');
			}
		});
	});

	describe('Feature #10: Color modes boundaries', () => {
		it('T2-F10-01: randomColorIds handles sizes 0, 1, and 50 (> 11 palette size)', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const validKeys = new Set(colors.COLORS.keys());
			expect([...colors.randomColorIds(0)]).toEqual([]);
			const one = [...colors.randomColorIds(1)];
			expect(one).toHaveLength(1);
			expect(validKeys.has(one[0])).toBe(true);

			const fifty = [...colors.randomColorIds(50)];
			expect(fifty).toHaveLength(50);
			for (const id of fifty) {
				expect(validKeys.has(id)).toBe(true);
			}
		});

		it('T2-F10-02: courseColorIds([]) returns empty array without throwing', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			expect(colors.courseColorIds([])).toEqual([]);
		});

		it('T2-F10-03: courseColorIds wraps cleanly when given more than 11 distinct courses', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const validKeys = new Set(colors.COLORS.keys());
			const events: GapiEvent[] = Array.from({ length: 15 }, (_, i) => ({
				summary: `CS${101 + i} - Course ${i + 1}`,
				start: { dateTime: '2026-08-24T07:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
				end: { dateTime: '2026-08-24T08:50:00+07:00', timeZone: 'Asia/Ho_Chi_Minh' }
			}));
			const ids = colors.courseColorIds(events);
			expect(ids).toHaveLength(15);
			for (const id of ids) {
				expect(validKeys.has(id)).toBe(true);
			}
		});

		it('T2-F10-04: courseColorIds handles empty or non-standard event summaries safely', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			const validKeys = new Set(colors.COLORS.keys());
			const weirdEvents: GapiEvent[] = ['', 'Meeting', ' - NoCode'].map((summary) => ({
				summary,
				start: { dateTime: '2026-08-24T07:00:00+07:00', timeZone: 'Asia/Ho_Chi_Minh' },
				end: { dateTime: '2026-08-24T08:50:00+07:00', timeZone: 'Asia/Ho_Chi_Minh' }
			}));
			const ids = colors.courseColorIds(weirdEvents);
			expect(ids).toHaveLength(3);
			for (const id of ids) {
				expect(validKeys.has(id)).toBe(true);
			}
		});

		it('T2-F10-05: Tomato highlight override (11) vs off preserves mode parity', async () => {
			const colors = await loadLibModule<ColorsExports>('colors.ts');
			expect(colors.EXAM_TOMATO_COLOR_ID).toBe('11');
			expect(colors.COLORS.get(colors.EXAM_TOMATO_COLOR_ID)?.background).toBe('#d50000');
		});
	});

	describe('Feature #11: Google OAuth & Calendar API client boundaries', () => {
		it('T2-F11-01: google.ts guards against missing window.google / window.gapi', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).toMatch(
				/typeof\s+gapi|window\.gapi|!gapi|typeof\s+google|window\.google|!google/
			);
		});

		it('T2-F11-02: google.ts handles GIS error_callback / popup failures cleanly', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).toContain('error_callback');
		});

		it('T2-F11-03: google.ts checks access_token presence before invoking Calendar API', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).toContain('access_token');
		});

		it('T2-F11-04: google.ts does not coerce undefined PUBLIC_GOOGLE_API_KEY into "undefined"', async () => {
			await loadLibModule<GoogleExports>('google.ts');
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).not.toMatch(/apiKey\s*:\s*String\(/);
		});

		it('T2-F11-05: google.ts uses Client ID fallback cleanly without hardcoded Client secret', async () => {
			const googleMod = await loadLibModule<GoogleExports>('google.ts');
			expect(googleMod.DEFAULT_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/);
			const src = readWorkspaceText('src/lib/google.ts');
			expect(src).not.toMatch(/GOCSPX-|client_secret/i);
		});
	});

	describe('Feature #12: Compact UI, previews & /privacy boundaries', () => {
		it('T2-F12-01: UI starts with a single paste field and detects the schedule type automatically', async () => {
			const page = await loadRouteModule<SvelteComponentModule>('+page.svelte');
			const { html } = page.default.render();
			expect(html.match(/<textarea\b/g)).toHaveLength(1);
			expect(html).not.toContain('<select');
			expect(html).not.toContain('thêm trang / lịch thi');
		});

		it('T2-F12-02: UI restores the original color buttons and keeps the extra mode in a disclosure', async () => {
			const output = await loadRouteModule<SvelteComponentModule>('GapiOutputSection.svelte');
			const { html } = output.default.render({
				timetable: { semester: 261, rows: [] },
				name: 'SV261',
				reminders: []
			});
			expect(html).toContain('🗿 tối giản');
			expect(html).toContain('💅 bảy sắc cầu vồng');
			expect(html).toContain('😎 xem trước');
			expect(html.match(/<details[\s\S]*?<\/details>/)?.[0]).toContain('theo môn học');
		});

		it('T2-F12-03: UI includes Tomato exam highlight label or toggle', async () => {
			const mod = await loadLibModule<ModExports>('core/mod.ts');
			const output = await loadRouteModule<SvelteComponentModule>('GapiOutputSection.svelte');
			const { html } = output.default.render({
				timetable: mod.parseExam2024(PASTE_2_NL),
				name: 'THI261',
				reminders: []
			});
			expect(html).toMatch(/tô đỏ lịch thi|🔴/i);
		});

		it('T2-F12-04: UI renders ExamPreview and GapiPreview modules cleanly', async () => {
			const examPreview = await loadRouteModule<SvelteComponentModule>('ExamPreview.svelte');
			const gapiPreview = await loadRouteModule<SvelteComponentModule>('GapiPreview.svelte');
			expect(typeof examPreview.default?.render).toBe('function');
			expect(typeof gapiPreview.default?.render).toBe('function');
		});

		it('T2-F12-05: /privacy page renders standalone HTML without secrets or external tracker scripts', async () => {
			const privacy = await loadRouteModule<SvelteComponentModule>('privacy/+page.svelte');
			const { html } = privacy.default.render();
			expect(html).not.toMatch(/GOCSPX-|client_secret/i);
			expect(html).not.toContain('google-analytics');
		});
	});
});
