import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { describe, expect, it } from 'vitest';
import { ASIA_HO_CHI_MINH, DAY, HOUR, MINUTE, WEEK } from '$lib/core/constants';
import type { ExamRow, Timerow, Timetable } from '$lib/core/timetable';
import {
	MixedSemesterError,
	UnresolvedError,
	dayOfWeek,
	isUnresolvable,
	resolve
} from '$lib/core/resolver';
import { NumOfColumnMismatchError, ParseError } from '$lib/core/parser/errors';
import {
	addMinutesToHm,
	extractTableRows,
	hmFrom,
	parseExamTime,
	parseTime
} from '$lib/core/parser/utils';

function makeTimerow(overrides: Partial<Timerow> = {}): Timerow {
	return {
		name: 'CO2003 Cấu trúc Dữ liệu và Giải Thuật',
		weekday: 3,
		startHm: [13, 0],
		endHm: [14, 50],
		weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47, null, 49, 50],
		location: 'B1-306',
		extras: { group: 'CC01', campus: 'BK-CS1' },
		...overrides
	};
}

function makeExamRow(overrides: Partial<ExamRow> = {}): ExamRow {
	return {
		semester: 20261,
		courseCode: 'CO2011',
		courseName: 'Mô hình hóa Toán học',
		rawCourse: 'CO2011 - Mô hình hóa Toán học',
		group: 'CC02_C_Thi',
		date: '2026-12-28',
		examType: 'CK',
		campus: 'BK-CS1',
		room: 'B4-305',
		weekday: 2,
		startHm: [7, 0],
		endHm: [8, 20],
		durationMinutes: 80,
		updatedAt: '2026-10-23 10:10:00',
		...overrides
	};
}

async function runResolverInFreshProcessWithTz(tz: string) {
	const constantsSrc = readFileSync(resolvePath('src/lib/core/constants.ts'), 'utf8');
	const resolverSrc = readFileSync(resolvePath('src/lib/core/resolver.ts'), 'utf8');

	const constantsJs = (await transformWithEsbuild(constantsSrc, 'constants.ts')).code;
	const constantsDataUrl = `data:text/javascript;base64,${Buffer.from(constantsJs).toString('base64')}`;

	const resolverJs = (await transformWithEsbuild(resolverSrc, 'resolver.ts')).code.replace(
		/['"]\.\/constants['"]/g,
		JSON.stringify(constantsDataUrl)
	);
	const resolverDataUrl = `data:text/javascript;base64,${Buffer.from(resolverJs).toString('base64')}`;

	const runnerScript = `
		import { dayOfWeek, resolve } from ${JSON.stringify(resolverDataUrl)};
		const target = Date.UTC(2026, 7, 30, 0, 0, 0);
		const nativeGetDay = new Date(target).getDay();
		const dowSun = dayOfWeek(target);
		const dowMon0 = dayOfWeek(Date.UTC(2026, 7, 24, 0, 0, 0));
		const dowMon18 = dayOfWeek(Date.UTC(2026, 7, 24, 18, 0, 0));

		const tt261 = {
			semester: 261,
			rows: [
				{ name: 'SP1033', weekday: 2, startHm: [9, 0], endHm: [10, 50], weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47], location: 'C5', extras: {} },
				{ name: 'SK2001', weekday: 3, startHm: [15, 0], endHm: [17, 50], weeks: [null, null, null, null, null, null, null, null, null, null, null, 46, 47, null, 49, 50], location: 'C5', extras: {} },
				{ name: 'CO2011', weekday: 6, startHm: [9, 0], endHm: [10, 50], weeks: [null, null, null, null, 39, 40, 41], location: 'C5', extras: {} }
			]
		};
		resolve(tt261);

		const tt242 = {
			semester: 242,
			rows: [{ name: 'X', weekday: 2, startHm: [7, 0], endHm: [8, 50], weeks: [50, 51, 52, 1, 2], location: 'B1', extras: {} }]
		};
		resolve(tt242);

		const tt252Early = {
			semester: 252,
			rows: [{ name: 'E', weekday: 2, startHm: [7, 0], endHm: [8, 50], weeks: [30, 31], location: 'B1', extras: {} }]
		};
		resolve(tt252Early);

		const tt252Late = {
			semester: 252,
			rows: [{ name: 'L', weekday: 2, startHm: [7, 0], endHm: [8, 50], weeks: [4, 5], location: 'B1', extras: {} }]
		};
		resolve(tt252Late);

		const tt253 = {
			semester: 253,
			rows: [{ name: 'S3', weekday: 2, startHm: [7, 0], endHm: [8, 50], weeks: [23, 24], location: 'B1', extras: {} }]
		};
		resolve(tt253);

		console.log(JSON.stringify({
			nativeGetDay,
			dowSun,
			dowMon0,
			dowMon18,
			iso261: tt261.startMondayUTC.toISOString(),
			iso242: tt242.startMondayUTC.toISOString(),
			iso252Early: tt252Early.startMondayUTC.toISOString(),
			iso252Late: tt252Late.startMondayUTC.toISOString(),
			iso253: tt253.startMondayUTC.toISOString()
		}));
	`;

	const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', runnerScript], {
		env: { ...process.env, TZ: tz },
		encoding: 'utf8'
	});
	return JSON.parse(stdout.trim()) as {
		nativeGetDay: number;
		dowSun: number;
		dowMon0: number;
		dowMon18: number;
		iso261: string;
		iso242: string;
		iso252Early: string;
		iso252Late: string;
		iso253: string;
	};
}

describe('constants', () => {
	it('defines exact millisecond constants and HCM timezone', () => {
		expect(MINUTE).toBe(60_000);
		expect(HOUR).toBe(3_600_000);
		expect(DAY).toBe(86_400_000);
		expect(WEEK).toBe(604_800_000);
		expect(ASIA_HO_CHI_MINH).toBe('Asia/Ho_Chi_Minh');
	});
});

describe('resolver: timezone invariance & dayOfWeek', () => {
	it('verifies native getDay() diverges in NY vs HCM on 2026-08-30T00:00:00Z while dayOfWeek and resolve stay UTC-invariant', async () => {
		const ny = await runResolverInFreshProcessWithTz('America/New_York');
		const hcm = await runResolverInFreshProcessWithTz('Asia/Ho_Chi_Minh');
		const utc = await runResolverInFreshProcessWithTz('UTC');

		// Sanity guard: process-level TZ genuinely changes Date.prototype.getDay()
		expect(ny.nativeGetDay).toBe(6);
		expect(hcm.nativeGetDay).toBe(0);
		expect(utc.nativeGetDay).toBe(0);
		expect(ny.nativeGetDay).not.toBe(hcm.nativeGetDay);

		for (const res of [ny, hcm, utc]) {
			expect(res.dowSun).toBe(8);
			expect(res.dowMon0).toBe(2);
			expect(res.dowMon18).toBe(2);
			expect(res.iso261).toBe('2026-08-24T00:00:00.000Z');
			expect(res.iso242).toBe('2024-12-09T00:00:00.000Z');
		}

		expect(ny.iso252Early).toBe(hcm.iso252Early);
		expect(utc.iso252Early).toBe(hcm.iso252Early);
		expect(ny.iso252Late).toBe(hcm.iso252Late);
		expect(utc.iso252Late).toBe(hcm.iso252Late);
		expect(ny.iso253).toBe(hcm.iso253);
		expect(utc.iso253).toBe(hcm.iso253);
	});

	it('resolves dayOfWeek and semester 261 / 242 directly via $lib/core/resolver', () => {
		expect(dayOfWeek(Date.UTC(2026, 7, 30, 0, 0, 0))).toBe(8);
		expect(dayOfWeek(Date.UTC(2026, 7, 24, 0, 0, 0))).toBe(2);
		expect(dayOfWeek(Date.UTC(2026, 7, 24, 18, 0, 0))).toBe(2);

		const tt261: Timetable = {
			semester: 261,
			rows: [
				makeTimerow({
					name: 'SP1033',
					weekday: 2,
					weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47]
				}),
				makeTimerow({
					name: 'SK2001',
					weekday: 3,
					weeks: [
						null,
						null,
						null,
						null,
						null,
						null,
						null,
						null,
						null,
						null,
						null,
						46,
						47,
						null,
						49,
						50
					]
				}),
				makeTimerow({
					name: 'CO2011',
					weekday: 6,
					weeks: [null, null, null, null, 39, 40, 41]
				})
			]
		};
		resolve(tt261);
		expect(tt261.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');

		const tt242: Timetable = {
			semester: 242,
			rows: [makeTimerow({ weeks: [50, 51, 52, 1, 2] })]
		};
		resolve(tt242);
		expect(tt242.startMondayUTC?.toISOString()).toBe('2024-12-09T00:00:00.000Z');
	});
});

describe('resolver: exam-only, errors, and pre-set startMondayUTC', () => {
	it('succeeds without throwing UnresolvedError for exam-only timetables', () => {
		const ttEmptyRows: Timetable = {
			semester: 261,
			rows: [],
			exams: [makeExamRow()]
		};
		expect(() => resolve(ttEmptyRows)).not.toThrow();
		expect(ttEmptyRows.startMondayUTC).toBeUndefined();

		const ttUnresolvableRows: Timetable = {
			semester: 261,
			rows: [makeTimerow({ weekday: NaN })],
			exams: [makeExamRow()]
		};
		expect(() => resolve(ttUnresolvableRows)).not.toThrow();
		expect(ttUnresolvableRows.startMondayUTC).toBeUndefined();
	});

	it('throws UnresolvedError when there are no resolvable rows and no exams', () => {
		expect(() => resolve({ semester: 261, rows: [] })).toThrow(UnresolvedError);
		expect(() => resolve({ semester: 261, rows: [], exams: [] })).toThrow(UnresolvedError);
		expect(() => resolve({ semester: 261, rows: [makeTimerow({ weekday: NaN })] })).toThrow(
			UnresolvedError
		);
		expect(() => resolve({ semester: 261, rows: [makeTimerow({ weeks: [] })] })).toThrow(
			UnresolvedError
		);
		expect(() => resolve({ semester: 261, rows: [makeTimerow({ weeks: [null, null] })] })).toThrow(
			UnresolvedError
		);
	});

	it('checks rows for MixedSemesterError even when exams are present', () => {
		const tt: Timetable = {
			semester: 261,
			rows: [
				makeTimerow({ weeks: [35, 36] }),
				makeTimerow({ weeks: [36, 37] }) // implies weekOfIndex0 = 36
			],
			exams: [makeExamRow()]
		};
		expect(() => resolve(tt)).toThrow(MixedSemesterError);
	});

	it('preserves pre-set startMondayUTC without recomputing', () => {
		const preset = new Date('2026-08-17T00:00:00.000Z');
		const tt: Timetable = {
			semester: 261,
			startMondayUTC: preset,
			rows: [makeTimerow({ weeks: [35, 36] })]
		};
		resolve(tt);
		expect(tt.startMondayUTC).toBe(preset);
	});

	it('identifies unresolvable rows accurately', () => {
		expect(isUnresolvable(makeTimerow({ weekday: NaN }))).toBe(true);
		expect(isUnresolvable(makeTimerow({ weeks: [] }))).toBe(true);
		expect(isUnresolvable(makeTimerow({ weeks: [null] }))).toBe(true);
		expect(isUnresolvable(makeTimerow({ weeks: [null, null] }))).toBe(true);
		expect(isUnresolvable(makeTimerow({ weeks: [null, 36] }))).toBe(false);
	});
});

describe('parser/utils: time helpers', () => {
	it('parseTime parses HH:MM and "-" dash', () => {
		expect(parseTime('9:00')).toEqual([9, 0]);
		expect(parseTime(' 13:50 ')).toEqual([13, 50]);
		expect(parseTime('-')).toEqual([0, 0]);
		expect(() => parseTime('--')).toThrow(ParseError);
		expect(() => parseTime('abc')).toThrow(ParseError);
		expect(() => parseTime(':30')).toThrow(ParseError);
	});

	it('hmFrom maps tiết 0..17 and rejects >= 18', () => {
		expect(hmFrom(0)).toEqual({ startHm: [0, 0], endHm: [0, 0] });
		expect(hmFrom(1)).toEqual({ startHm: [6, 0], endHm: [6, 50] });
		expect(hmFrom(13)).toEqual({ startHm: [18, 0], endHm: [18, 50] });
		expect(hmFrom(14)).toEqual({ startHm: [18, 50], endHm: [19, 40] });
		expect(hmFrom(17)).toEqual({ startHm: [21, 20], endHm: [22, 10] });
		expect(() => hmFrom(18)).toThrow(ParseError);
		expect(() => hmFrom(-1)).toThrow(ParseError);
	});

	it('parseExamTime supports HHgMM and HH:MM and rejects invalid times', () => {
		expect(parseExamTime('07g00')).toEqual([7, 0]);
		expect(parseExamTime(' 09G30 ')).toEqual([9, 30]);
		expect(parseExamTime('15g30')).toEqual([15, 30]);
		expect(parseExamTime('13:00')).toEqual([13, 0]);
		expect(parseExamTime('9:05')).toEqual([9, 5]);
		expect(() => parseExamTime('--')).toThrow(ParseError);
		expect(() => parseExamTime('24g00')).toThrow(ParseError);
		expect(() => parseExamTime('09g60')).toThrow(ParseError);
		expect(() => parseExamTime('invalid')).toThrow(ParseError);
	});

	it('addMinutesToHm computes end times including midnight wrap', () => {
		expect(addMinutesToHm([7, 0], 80)).toEqual([8, 20]);
		expect(addMinutesToHm([9, 30], 50)).toEqual([10, 20]);
		expect(addMinutesToHm([9, 30], 90)).toEqual([11, 0]);
		expect(addMinutesToHm([15, 30], 90)).toEqual([17, 0]);
		expect(addMinutesToHm([13, 0], 70)).toEqual([14, 10]);
		expect(addMinutesToHm([23, 30], 60)).toEqual([0, 30]);
		expect(() => addMinutesToHm([7, 0], Number.NaN)).toThrow(ParseError);
	});
});

describe('parser/utils: extractTableRows', () => {
	const STUDENT_2024_HEADER = [
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
		'TUẦN HỌC'
	];

	const EXAM_2024_HEADER = [
		'Học kỳ',
		'Môn học',
		'Nhóm lớp',
		'Ngày thi',
		'Loại thi',
		'Cơ sở',
		'Mã phòng',
		'Thứ',
		'Giờ bắt đầu',
		'Tổng số phút',
		'Cập nhật cuối cùng vào lúc'
	];

	it('extracts Paste #1 style 12-column rows in both newline and tab modes', () => {
		const sampleRows = [
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
				'35|36|37|38|39|--|--|--|43|44|45|46|47|48|49|50|'
			],
			[
				'20261',
				'SP1033',
				'Kinh tế Chính trị Mác - Lênin',
				'2',
				'2',
				'CC02',
				'2',
				'4 - 5',
				'9:00 - 10:50',
				'C5-HOITRUONG',
				'BK-CS1',
				'35|--|37|38|39|40|41|--|43|44|45|46|47|'
			]
		];

		const newlineLines = [
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
			'Trình bày 10 dòng/trang',
			...STUDENT_2024_HEADER,
			...sampleRows.flat(),
			'Trình bày từ dòng 1 đến 10 / 13 dòng',
			'[Lùi](https://mybk.hcmut.edu.vn/app)'
		];

		const extractedNl = extractTableRows(newlineLines, STUDENT_2024_HEADER);
		expect(extractedNl).not.toBeNull();
		expect(extractedNl?.mode).toBe('newline');
		expect(extractedNl?.headerIndex).toBe(2);
		expect(extractedNl?.rows).toEqual(sampleRows);

		const tabLines = [
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
			STUDENT_2024_HEADER.join('\t'),
			...sampleRows.map((r) => r.join('\t')),
			'Tổng số tín chỉ đăng ký: 16'
		];

		const extractedTab = extractTableRows(tabLines, STUDENT_2024_HEADER);
		expect(extractedTab).not.toBeNull();
		expect(extractedTab?.mode).toBe('tab');
		expect(extractedTab?.headerIndex).toBe(1);
		expect(extractedTab?.rows).toEqual(sampleRows);
	});

	it('extracts Paste #2 style 11-column exam rows in both newline and tab modes', () => {
		const examRows = [
			[
				'20261',
				'CO2011 - Mô hình hóa Toán học',
				'CC02_C_Thi',
				'2026-12-28',
				'CK',
				'BK-CS1',
				'B4-305',
				'2',
				'07g00',
				'80',
				'2026-10-23 10:10:00'
			],
			[
				'20261',
				'SP1033 - Kinh tế Chính trị Mác - Lênin',
				'CC02_D_Thi',
				'2026-12-31',
				'CK',
				'BK-CS1',
				'B4-502',
				'5',
				'09g30',
				'50',
				'2026-10-23 10:10:00'
			]
		];

		const nlLines = [
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
			...EXAM_2024_HEADER,
			...examRows.flat(),
			'Trình bày từ dòng 1 đến 9 / 9 dòng'
		];
		const extractedNl = extractTableRows(nlLines, EXAM_2024_HEADER);
		expect(extractedNl?.mode).toBe('newline');
		expect(extractedNl?.rows).toEqual(examRows);

		const tabLines = [
			EXAM_2024_HEADER.join('\t'),
			...examRows.map((r) => r.join('\t')),
			'Version 2.4.0'
		];
		const extractedTab = extractTableRows(tabLines, EXAM_2024_HEADER);
		expect(extractedTab?.mode).toBe('tab');
		expect(extractedTab?.rows).toEqual(examRows);
	});

	it('handles CRLF, NBSP, and preserves trailing empty tab columns', () => {
		const lines = [
			`${STUDENT_2024_HEADER.join('\t')}\r`,
			'20261\tCO2003\tCấu trúc\u00a0Dữ liệu\t4\t4\tCC01\t3\t8 - 9\t13:00 - 14:50\tB1-306\tBK-CS1\t\r',
			'Trình bày từ dòng 1 đến 1 / 1 dòng\r'
		];
		const extracted = extractTableRows(lines, STUDENT_2024_HEADER);
		expect(extracted?.mode).toBe('tab');
		expect(extracted?.rows).toHaveLength(1);
		expect(extracted?.rows[0][2]).toBe('Cấu trúc Dữ liệu');
		expect(extracted?.rows[0][11]).toBe('');
	});

	it('throws NumOfColumnMismatchError on mismatched tab or truncated newline rows', () => {
		const badTab = [STUDENT_2024_HEADER.join('\t'), '20261\tCO2003\tMissing columns'];
		expect(() => extractTableRows(badTab, STUDENT_2024_HEADER)).toThrow(NumOfColumnMismatchError);

		const badNewline = [...EXAM_2024_HEADER, '20261', 'CO2011 - Mô hình hóa Toán học'];
		expect(() => extractTableRows(badNewline, EXAM_2024_HEADER)).toThrow(NumOfColumnMismatchError);
	});

	it('returns null when header is absent', () => {
		expect(extractTableRows(['random', 'text'], STUDENT_2024_HEADER)).toBeNull();
	});
});
