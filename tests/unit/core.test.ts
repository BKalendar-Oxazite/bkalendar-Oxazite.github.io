import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { describe, expect, it } from 'vitest';
import * as core from '$lib/core/mod';
import {
	ASIA_HO_CHI_MINH,
	DAY,
	HOUR,
	MINUTE,
	MixedSemesterError,
	NumOfColumnMismatchError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError,
	UnresolvedError,
	WEEK,
	dayOfWeek,
	detectKind,
	escapeIcalText,
	extractMeta,
	formatExamDescription,
	formatExamLocation,
	formatExamSummary,
	formatGapi,
	formatGapiSplit,
	formatGoogleCalendarTemplateUrl,
	formatHCM,
	formatHCMRfc3339,
	formatIcal,
	formatUTC,
	hcmDateToUtc,
	icalRrule,
	isUnresolvable,
	mergeTimetables,
	parseExam2024,
	parseLecturer,
	parsePostgrad,
	parseStudent,
	parseStudent2024,
	resolve,
	type ExamRow,
	type Timerow,
	type Timetable
} from '$lib/core/mod';

const PASTE_1_STUDENT_2024 = `[myBk/app](https://mybk.hcmut.edu.vn/app)[Toggle navigation](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[SINH VIÊN MẪU](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
SINH VIÊN MẪU
[Khoa Khoa học và Kỹ thuật Máy tính](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[Sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[Dịch vụ sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[Kết quả học tập](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[Tài liệu hướng dẫn](http://wiki.hcmut.edu.vn/)
Hệ thống quản lý Quản lý người dùng
[Quản lý người dùng](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
Người dùng
Trở về trang trước
THỜI KHÓA BIỂU HỌC KỲ
Họ tên: SINH VIÊN MẪU (DEMO-STUDENT-ID)
Tuần: 47 , Thứ Ba, Ngày 17/11/2026
Ghi chú: Các môn học có trong Thời khóa biểu là kết quả đăng ký môn học chính thức.Sinh viên chỉ được thực hiện Đồ án, Thực tập, Luận văn tốt nghiệp, ... và được ghi điểm vào cuối học kỳ khi các môn này có trong Thời khóa biểu (có phân nhóm). Với các môn không có Thứ, Tiết, Phòng: sinh viên liên hệ Bộ môn/Khoa để được hướng dẫn.
Tất cả học kì99992 - Học kỳ Nhập điểm Thi Lại99991 - Học kỳ Nhập điểm Bảo Lưu, Miễn20291 - Học kỳ 1 Năm học 2029 - 203020283 - Học kỳ 3 Năm học 2028 - 202920282 - Học kỳ 2 Năm học 2028 - 202920281 - Học kỳ 1 Năm học 2028 - 202920273 - Học kỳ 3 Năm học 2027 - 202820272 - Học kỳ 2 Năm học 2027 - 202820271 - Học kỳ 1 Năm học 2027 - 202820263 - Học kỳ 3 Năm học 2026 - 202720262 - Học kỳ 2 Năm học 2026 - 202720261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)20253 - Học kỳ 3 Năm học 2025 - 202620252 - Học kỳ 2 Năm học 2025 - 202620251 - Học kỳ 1 Năm học 2025 - 202620243 - Học kỳ 3 Năm học 2024 - 2025
20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 13/11/2026 13:41:36
Trình bày 102550100 dòng/trang
Tìm kiếm:
HỌC KỲ
MÃ MH
TÊN MÔN HỌC
TÍN CHỈ
TC HỌC PHÍ
NHÓM - TỔ
THỨ
TIẾT
GIỜ HỌC
PHÒNG
CƠ SỞ
TUẦN HỌC
20261
SA0002
Sinh hoạt Sinh viên
0
0
CC77
--
--
--
CS1
BK-CS1
35|36|37|38|39|--|--|--|43|44|45|46|47|48|49|50|
20261
SP1033
Kinh tế Chính trị Mác - Lênin
2
2
CC02
2
4 - 5
9:00 - 10:50
C5-HOITRUONG
BK-CS1
35|--|37|38|39|40|41|--|43|44|45|46|47|
20261
CO2003
Cấu trúc Dữ liệu và Giải Thuật
4
4
CC01
3
8 - 9
13:00 - 14:50
B1-306
BK-CS1
35|--|37|38|39|40|41|--|43|44|45|46|47|--|49|50|
20261
SK2001
Kỹ năng Tư duy khoa học
0
0
CC52
3
10 - 12
15:00 - 17:50
C5-302
BK-CS1
--|--|--|--|--|--|--|--|--|--|--|46|47|--|49|50|
20261
CH1003
Hóa đại cương
3
3
CC06
3
4 - 5
9:00 - 10:50
C5-303
BK-CS1
35|--|37|38|39|40|41|--|43|44|45|46|47|--|49|50|
20261
CO2008
Kiến trúc Máy tính (Th)
0
0
CC06
4
8 - 12
13:00 - 17:50
C5-202
BK-CS1
--|--|--|--|--|--|41|--|43|--|45|--|47|
20261
CH1004
Hóa đại cương (TN)
0
0
CC11
5
2 - 6
7:00 - 11:50
B2-406
BK-CS1
--|--|--|38|39|40|41|
20261
CO2004
Cấu trúc Dữ liệu và Giải Thuật (Th)
0
0
CC01
5
8 - 12
13:00 - 17:50
C6-102
BK-CS1
--|--|--|38|--|40|--|--|--|44|--|46|--|48|--|50|
20261
CO2011
Mô hình hóa Toán học
3
3
CC02
6
4 - 5
9:00 - 10:50
C5-502
BK-CS1
35|36|37|38|--|--|--|--|43|44|45|
20261
CO2011
Mô hình hóa Toán học
3
3
CC02
6
4 - 5
9:00 - 10:50
C5-502
BK-CS1
--|--|--|--|39|40|41|--|--|--|--|46|47|48|49|50|
Trình bày từ dòng 1 đến 10 / 13 dòng
[Lùi](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[1](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[2](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
[Tới](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)
Tổng số tín chỉ đăng ký: 16
Version 2.4.0
Copyright © 2026 [Academic Affairs Office](http://www.aao.hcmut.edu.vn/). All rights reserved.`;

const PASTE_2_EXAM_2024 = `[myBk/app](https://mybk.hcmut.edu.vn/app)[Toggle navigation](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[SINH VIÊN MẪU](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
SINH VIÊN MẪU
[Khoa Khoa học và Kỹ thuật Máy tính](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[Sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[Dịch vụ sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[Kết quả học tập](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[Tài liệu hướng dẫn](http://wiki.hcmut.edu.vn/)
Hệ thống quản lý Quản lý người dùng
[Quản lý người dùng](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
Người dùng
Trở về trang trước
LỊCH KIỂM TRA - THI HỌC KỲ
Họ tên: SINH VIÊN MẪU (DEMO-STUDENT-ID)
Tất cả học kì99992 - Học kỳ Nhập điểm Thi Lại99991 - Học kỳ Nhập điểm Bảo Lưu, Miễn20291 - Học kỳ 1 Năm học 2029 - 203020283 - Học kỳ 3 Năm học 2028 - 202920261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)20253 - Học kỳ 3 Năm học 2025 - 2026
20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Trình bày 102550100 dòng/trang
Tìm kiếm:
Học kỳ
Môn học
Nhóm lớp
Ngày thi
Loại thi
Cơ sở
Mã phòng
Thứ
Giờ bắt đầu
Tổng số phút
Cập nhật cuối cùng vào lúc
20261
CO2011 - Mô hình hóa Toán học
CC02_C_Thi
2026-12-28
CK
BK-CS1
B4-305
2
07g00
80
2026-10-23 10:10:00
20261
SP1033 - Kinh tế Chính trị Mác - Lênin
CC02_D_Thi
2026-12-31
CK
BK-CS1
B4-502
5
09g30
50
2026-10-23 10:10:00
20261
CO2007 - Kiến trúc Máy tính
CC03_B_Thi
2026-12-30
CK
BK-CS1
B4-406
4
09g30
90
2026-10-23 10:10:00
20261
CH1003 - Hóa đại cương
CC06_A_Thi
2026-12-18
CK
BK-CS1
B4-501
6
09g30
70
2026-10-23 10:10:00
20261
CNTTNC - CNTTNC
CC14_A_Thi
2026-12-05
CK
BK-CS1
C6-102
7
09g30
90
2026-10-26 14:10:00
20261
CO2003 - Cấu trúc Dữ liệu và Giải Thuật
CC01_A_Thi
2026-12-25
CK
BK-CS1
B4-504
6
15g30
90
2026-10-23 10:10:00
20261
CO2003 - Cấu trúc Dữ liệu và Giải Thuật
CC01_A_Ktr
2026-10-15
GK
BK-CS1
B4-405
5
07g00
60
2026-09-21 14:09:00
20261
CO2007 - Kiến trúc Máy tính
CC03_B_Ktr
2026-10-12
GK
BK-CS1
B6-306
2
09g00
60
2026-09-21 14:09:00
20261
CO2011 - Mô hình hóa Toán học
CC02_C_Ktr
2026-10-16
GK
BK-CS1
C4-403
6
13g00
70
2026-09-21 14:09:00
Trình bày từ dòng 1 đến 9 / 9 dòng
[Lùi](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[1](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
[Tới](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)
Version 2.4.0
Copyright © 2026 [Academic Affairs Office](http://www.aao.hcmut.edu.vn/). All rights reserved.`;

function toTabTable(newlineSrc: string, headerFirstCol: string, colCount: number): string {
	const lines = newlineSrc.split(/\r?\n/);
	const headerIdx = lines.findIndex((l) => l.trim().toLowerCase() === headerFirstCol.toLowerCase());
	const prefix = lines.slice(0, headerIdx);
	const tableLines: string[] = [];
	let cursor = headerIdx;
	while (cursor + colCount <= lines.length) {
		if (lines[cursor].startsWith('Trình bày từ dòng')) break;
		tableLines.push(lines.slice(cursor, cursor + colCount).join('\t'));
		cursor += colCount;
	}
	const suffix = lines.slice(cursor);
	return [...prefix, ...tableLines, ...suffix].join('\n');
}

describe('1. mod.ts barrel exports', () => {
	it('exports all required parsers, detect/merge, resolver, formatters, constants, and errors', () => {
		expect(core.ASIA_HO_CHI_MINH).toBe(ASIA_HO_CHI_MINH);
		expect(core.MINUTE).toBe(MINUTE);
		expect(core.HOUR).toBe(HOUR);
		expect(core.DAY).toBe(DAY);
		expect(core.WEEK).toBe(WEEK);

		expect(typeof core.parseStudent).toBe('function');
		expect(typeof core.parseStudent2024).toBe('function');
		expect(typeof core.parseLecturer).toBe('function');
		expect(typeof core.parsePostgrad).toBe('function');
		expect(typeof core.parseExam2024).toBe('function');

		expect(typeof core.detectKind).toBe('function');
		expect(typeof core.extractMeta).toBe('function');
		expect(typeof core.mergeTimetables).toBe('function');

		expect(typeof core.resolve).toBe('function');
		expect(typeof core.isUnresolvable).toBe('function');
		expect(typeof core.dayOfWeek).toBe('function');

		expect(typeof core.formatIcal).toBe('function');
		expect(typeof core.icalRrule).toBe('function');
		expect(typeof core.escapeIcalText).toBe('function');
		expect(typeof core.formatGapi).toBe('function');
		expect(typeof core.formatGapiSplit).toBe('function');
		expect(typeof core.formatGoogleCalendarTemplateUrl).toBe('function');

		expect(typeof core.dateOfIndex).toBe('function');
		expect(typeof core.hcmDateToUtc).toBe('function');
		expect(typeof core.examEndDateUtc).toBe('function');
		expect(typeof core.formatUTC).toBe('function');
		expect(typeof core.formatHCM).toBe('function');
		expect(typeof core.formatHCMRfc3339).toBe('function');
		expect(typeof core.formatExamLocation).toBe('function');
		expect(typeof core.formatExamSummary).toBe('function');
		expect(typeof core.formatExamDescription).toBe('function');

		expect(new ParseError('x', 'm')).toBeInstanceOf(Error);
		expect(new SemesterNotFoundError('x')).toBeInstanceOf(ParseError);
		expect(new NumOfColumnMismatchError('x', 12, 10)).toBeInstanceOf(ParseError);
		expect(new TableNotFoundError('x')).toBeInstanceOf(ParseError);
		expect(new MixedSemesterError(new Date(), new Date())).toBeInstanceOf(Error);
		expect(new UnresolvedError()).toBeInstanceOf(Error);
	});
});

describe('2. parseStudent2024', () => {
	it('parses verbatim Paste #1 (newline), ignores 20291 select trap, skips SA0002, preserves split CO2011, and resolves', () => {
		const tt = parseStudent2024(PASTE_1_STUDENT_2024);
		expect(tt.semester).toBe(261);
		expect(tt.rows).toHaveLength(9);

		expect(tt.rows[0]).toEqual({
			name: 'Kinh tế Chính trị Mác - Lênin',
			weekday: 2,
			startHm: [9, 0],
			endHm: [10, 50],
			weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47],
			location: 'C5-HOITRUONG',
			extras: {
				'mã môn học': 'SP1033',
				'tín chỉ': '2',
				'tín chỉ học phí': '2',
				'nhóm tổ': 'CC02'
			}
		});

		expect(tt.rows[1].name).toBe('Cấu trúc Dữ liệu và Giải Thuật');
		expect(tt.rows[1].weekday).toBe(3);
		expect(tt.rows[1].startHm).toEqual([13, 0]);
		expect(tt.rows[1].endHm).toEqual([14, 50]);

		expect(tt.rows[2].name).toBe('Kỹ năng Tư duy khoa học');
		expect(tt.rows[2].weeks).toEqual([
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
		]);

		// Both split-week CO2011 rows preserved cleanly without trailing NaN/0
		expect(tt.rows[7].name).toBe('Mô hình hóa Toán học');
		expect(tt.rows[7].weeks).toEqual([35, 36, 37, 38, null, null, null, null, 43, 44, 45]);
		expect(tt.rows[8].name).toBe('Mô hình hóa Toán học');
		expect(tt.rows[8].weeks).toEqual([
			null,
			null,
			null,
			null,
			39,
			40,
			41,
			null,
			null,
			null,
			null,
			46,
			47,
			48,
			49,
			50
		]);

		resolve(tt);
		expect(tt.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');
	});

	it('parses tab-delimited Paste #1 equivalently to newline Paste #1', () => {
		const tabPaste = toTabTable(PASTE_1_STUDENT_2024, 'HỌC KỲ', 12);
		const ttTab = parseStudent2024(tabPaste);
		const ttNl = parseStudent2024(PASTE_1_STUDENT_2024);
		expect(ttTab).toEqual(ttNl);
	});

	it('handles CN -> 8, skips "--" / "---" / "- - -" times, and handles weeks without trailing pipe', () => {
		const header =
			'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC';
		const src = [
			'Học kỳ 2 Năm học 2025 - 2026',
			header,
			'20252\tM1\tSkip Triple Dash\t0\t0\tL01\t--\t--\t---\tCS1\tBK-CS1\t05|06|',
			'20252\tM2\tSkip Spaced Dash\t0\t0\tL01\t--\t--\t- - -\tCS1\tBK-CS1\t05|06|',
			'20252\tM3\tSunday Class\t2\t2\tL01\tCN\t2 - 3\t7:00 - 8:50\tH1-101\tBK-CS2\t05|06|07',
			'Trình bày từ dòng 1 đến 3 / 3 dòng'
		].join('\n');

		const tt = parseStudent2024(src);
		expect(tt.semester).toBe(252);
		expect(tt.rows).toHaveLength(1);
		expect(tt.rows[0].weekday).toBe(8);
		expect(tt.rows[0].weeks).toEqual([5, 6, 7]);
	});

	it('supports <select>-only (Hiện hành) semester extraction, NFD/CRLF/NBSP, and row[0] fallback', () => {
		const header =
			'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC';
		const selectOnly = [
			'Tất cả học kì20291 - Học kỳ 1 Năm học 2029 - 203020261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)20253 - Học kỳ 3 Năm học 2025 - 2026',
			header.normalize('NFD').replace(/ /g, '\u00a0'),
			'20261\tCO1001\tNhập môn\t3\t3\tL01\t2\t2 - 3\t7:00 - 8:50\tB1\tCS1\t35|36|'
		].join('\r\n');
		expect(parseStudent2024(selectOnly).semester).toBe(261);

		const headerlessFallback = [
			header,
			'20261\tCO1001\tNhập môn\t3\t3\tL01\t2\t2 - 3\t7:00 - 8:50\tB1\tCS1\t35|36|'
		].join('\n');
		expect(parseStudent2024(headerlessFallback).semester).toBe(261);
	});

	it('never leaks 20291 from <select> when standalone banner and (Hiện hành) are absent, and prefers cols[0] over <select> (Hiện hành) for past semesters', () => {
		// Paste #1 with standalone banner removed and (Hiện hành) stripped from <select>
		const noBannerNoCurrent = PASTE_1_STUDENT_2024.replace(
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)\n',
			''
		).replace('(Hiện hành)', '');
		const ttNoCurrent = parseStudent2024(noBannerNoCurrent);
		expect(ttNoCurrent.semester).toBe(261);

		// Past-semester cols[0]=20252 with standalone banner removed while <select> retains 20261 (Hiện hành)
		const pastCols0WithSelectCurrent = PASTE_1_STUDENT_2024.replace(
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)\n',
			''
		).replace(/\n20261\n/g, '\n20252\n');
		const ttPast = parseStudent2024(pastCols0WithSelectCurrent);
		expect(ttPast.semester).toBe(252);

		// Empty 0-row table with <select> (Hiện hành) still falls back to (Hiện hành) -> 261
		const emptyWithSelectCurrent = [
			'Tất cả học kì20291 - Học kỳ 1 Năm học 2029 - 203020261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
			'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC'
		].join('\n');
		expect(parseStudent2024(emptyWithSelectCurrent).semester).toBe(261);
	});

	it('throws TableNotFoundError, NumOfColumnMismatchError, SemesterNotFoundError, and ParseError with cols[8]', () => {
		expect(() => parseStudent2024('not a timetable')).toThrow(TableNotFoundError);

		const header =
			'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC';
		expect(() => parseStudent2024(`${header}\n20261\tCO1001\tShort row`)).toThrow(
			NumOfColumnMismatchError
		);

		expect(() => parseStudent2024(header)).toThrow(SemesterNotFoundError);

		const badTime = `${header}\n20261\tCO1001\tMôn\t3\t3\tL01\t2\t2 - 3\tBAD_TIME\tB1\tCS1\t35|`;
		try {
			parseStudent2024(badTime);
			expect.unreachable('Expected ParseError');
		} catch (err) {
			expect(err).toBeInstanceOf(ParseError);
			expect((err as ParseError).src).toBe('BAD_TIME');
		}
	});
});

describe('3. parseExam2024', () => {
	it('parses verbatim Paste #2 (newline), extracts 9 exams with computed end times, and resolves without UnresolvedError', () => {
		const tt = parseExam2024(PASTE_2_EXAM_2024);
		expect(tt.semester).toBe(261);
		expect(tt.rows).toEqual([]);
		expect(tt.exams).toHaveLength(9);

		resolve(tt);
		expect(tt.startMondayUTC).toBeUndefined();

		const exams = tt.exams!;
		expect(exams[0]).toEqual({
			semester: 261,
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
			updatedAt: '2026-10-23 10:10:00'
		});

		// Splits on first " - " only
		expect(exams[1].courseCode).toBe('SP1033');
		expect(exams[1].courseName).toBe('Kinh tế Chính trị Mác - Lênin');
		expect(exams[1].startHm).toEqual([9, 30]);
		expect(exams[1].endHm).toEqual([10, 20]);

		// Course code equals name
		expect(exams[4].courseCode).toBe('CNTTNC');
		expect(exams[4].courseName).toBe('CNTTNC');

		// Midterm GK entry
		expect(exams[6].examType).toBe('GK');
		expect(exams[6].startHm).toEqual([7, 0]);
		expect(exams[6].endHm).toEqual([8, 0]);
	});

	it('parses tab-delimited Paste #2 identically to newline Paste #2', () => {
		const tabPaste = toTabTable(PASTE_2_EXAM_2024, 'Học kỳ', 11);
		expect(parseExam2024(tabPaste)).toEqual(parseExam2024(PASTE_2_EXAM_2024));
	});

	it('supports HH:MM, HHGmm, CN -> 8, and header-less cols[0] fallback', () => {
		const header =
			'Học kỳ\tMôn học\tNhóm lớp\tNgày thi\tLoại thi\tCơ sở\tMã phòng\tThứ\tGiờ bắt đầu\tTổng số phút\tCập nhật cuối cùng vào lúc';
		const src = [
			header,
			'20261\tCO1001 - Tin học\tL01\t2026-12-20\tCK\t--\t--\tCN\t13:30\t90\t2026-11-01 08:00:00',
			'20261\tCO1002 - Toán\tL02\t2026-12-21\tGK\tBK-CS2\tH1-101\t2\t07G15\t60\t2026-11-01 08:00:00'
		].join('\n');

		const tt = parseExam2024(src);
		expect(tt.semester).toBe(261);
		expect(tt.exams).toHaveLength(2);
		expect(tt.exams![0].weekday).toBe(8);
		expect(tt.exams![0].startHm).toEqual([13, 30]);
		expect(tt.exams![0].endHm).toEqual([15, 0]);
		expect(tt.exams![1].startHm).toEqual([7, 15]);
		expect(tt.exams![1].endHm).toEqual([8, 15]);
	});

	it('never leaks 20291 from <select>, prefers cols[0]=20252 over <select> (Hiện hành), and normalizes NFD cells to NFC', () => {
		// Paste #2 with standalone banner removed and (Hiện hành) stripped from <select>
		const noBannerNoCurrent = PASTE_2_EXAM_2024.replace(
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)\n',
			''
		).replace('(Hiện hành)', '');
		const ttNoCurrent = parseExam2024(noBannerNoCurrent);
		expect(ttNoCurrent.semester).toBe(261);
		expect(ttNoCurrent.exams![0].semester).toBe(261);

		// Past-semester cols[0]=20252 with standalone banner removed while <select> retains 20261 (Hiện hành)
		const pastCols0WithSelectCurrent = PASTE_2_EXAM_2024.replace(
			'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)\n',
			''
		).replace(/\n20261\n/g, '\n20252\n');
		const ttPast = parseExam2024(pastCols0WithSelectCurrent);
		expect(ttPast.semester).toBe(252);
		expect(ttPast.exams![0].semester).toBe(252);

		// NFD-decomposed Paste #2 yields NFC courseName and deduplicates identically with NFC Paste #2
		const ttNfdExam = parseExam2024(PASTE_2_EXAM_2024.normalize('NFD'));
		expect(ttNfdExam.exams![1].courseName).toBe('Kinh tế Chính trị Mác - Lênin');
		expect(ttNfdExam).toEqual(parseExam2024(PASTE_2_EXAM_2024));

		const ttNfdStudent = parseStudent2024(PASTE_1_STUDENT_2024.normalize('NFD'));
		expect(ttNfdStudent.rows[0].name).toBe('Kinh tế Chính trị Mác - Lênin');
		expect(ttNfdStudent).toEqual(parseStudent2024(PASTE_1_STUDENT_2024));
	});

	it('throws appropriate errors for missing table, column mismatch, missing semester, and invalid fields', () => {
		expect(() => parseExam2024('nothing here')).toThrow(TableNotFoundError);

		const header =
			'Học kỳ\tMôn học\tNhóm lớp\tNgày thi\tLoại thi\tCơ sở\tMã phòng\tThứ\tGiờ bắt đầu\tTổng số phút\tCập nhật cuối cùng vào lúc';
		expect(() => parseExam2024(header)).toThrow(SemesterNotFoundError);
		expect(() => parseExam2024(`${header}\n20261\tCO1001`)).toThrow(NumOfColumnMismatchError);

		const badDate = `${header}\n20261\tCO1001 - A\tL01\t2026-02-30\tCK\tCS1\tB4\t2\t07g00\t60\t2026-10-01`;
		expect(() => parseExam2024(badDate)).toThrow(ParseError);

		const badTime = `${header}\n20261\tCO1001 - A\tL01\t2026-12-20\tCK\tCS1\tB4\t2\t25g00\t60\t2026-10-01`;
		expect(() => parseExam2024(badTime)).toThrow(ParseError);

		const badDuration = `${header}\n20261\tCO1001 - A\tL01\t2026-12-20\tCK\tCS1\tB4\t2\t07g00\t-10\t2026-10-01`;
		expect(() => parseExam2024(badDuration)).toThrow(ParseError);

		const badWeekday = `${header}\n20261\tCO1001 - A\tL01\t2026-12-20\tCK\tCS1\tB4\t1\t07g00\t60\t2026-10-01`;
		expect(() => parseExam2024(badWeekday)).toThrow(ParseError);
	});
});

describe('4. legacy parsers (student, lecturer, postgrad)', () => {
	it('parses legacy student timetable and resolves', () => {
		const src = [
			'Học kỳ 2 Năm học 2023 - 2024',
			'Tuần 10',
			'Mã MH\tTên môn học\tTín chỉ\tTC học phí\tNhóm-tổ\tThứ\tTiết\tGiờ học\tPhòng\tCơ sở\tTuần học',
			'CH1003\tHóa đại cương\t3\t3\tL14\t6\t10-12\t15:00 - 17:50\tH2-301\tBK-CS2\t--|09|10|11|',
			'Tổng số tín chỉ đăng ký: 3'
		].join('\r\n');

		const tt = parseStudent(src);
		expect(tt.semester).toBe(232);
		expect(tt.rows).toHaveLength(1);
		expect(tt.rows[0].extras).toEqual({
			'mã môn học': 'CH1003',
			'tín chỉ': '3',
			'tín chỉ học phí': '3',
			'nhóm tổ': 'L14'
		});
		expect(tt.rows[0].weeks).toEqual([null, 9, 10, 11]);
		resolve(tt);
		expect(tt.startMondayUTC).toBeInstanceOf(Date);

		expect(() => parseStudent('invalid')).toThrow(TableNotFoundError);
		expect(() =>
			parseStudent(
				'Mã MH\tTên môn học\tTín chỉ\tTC học phí\tNhóm-tổ\tThứ\tTiết\tGiờ học\tPhòng\tCơ sở\tTuần học'
			)
		).toThrow(SemesterNotFoundError);
	});

	it('parses lecturer timetable and resolves', () => {
		const src = [
			'Năm học 2022 - 2023',
			'Học kỳ 1',
			'Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND',
			'20221_CO1006_L11\tNHAP MON DIEN TOAN (TH)\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|--|38|39|\t0%',
			'Đang xem 1-1'
		].join('\n');

		const tt = parseLecturer(src);
		expect(tt.semester).toBe(221);
		expect(tt.rows).toHaveLength(1);
		expect(tt.rows[0].extras).toEqual({ lớp: '20221_CO1006_L11' });
		expect(tt.rows[0].weeks).toEqual([null, null, 38, 39]);
		resolve(tt);
		expect(tt.startMondayUTC).toBeInstanceOf(Date);

		expect(() => parseLecturer('Năm học 2022\nHọc kỳ 1\nno header')).toThrow(TableNotFoundError);
		expect(() => parseLecturer('no semester')).toThrow(SemesterNotFoundError);
	});

	it('parses postgrad timetable with pre-resolved startMondayUTC and Vietnamese weekdays', () => {
		const src = [
			'Học kỳ 2/2023-2024: 19/02/2024',
			'Info 1',
			'Info 2',
			'Info 3',
			'Cán bộ giảng dạy\tMôn học\tLớp/DS lớp\tThứ\tTiết bắt đầu\tTiết kết thúc\tPhòng\tTuần\tGhi chú',
			'GS.TS A\t(CO5143) - Xử lý ngôn ngữ\t1\tCN\t4\t6\tTrực tuyến\t|1|2|--|4|\tGhi chú',
			'Tối'
		].join('\n');

		const tt = parsePostgrad(src);
		expect(tt.semester).toBe(232);
		expect(tt.startMondayUTC?.toISOString()).toBe('2024-02-19T00:00:00.000Z');
		expect(tt.rows).toHaveLength(1);
		expect(tt.rows[0].weekday).toBe(8);
		expect(tt.rows[0].startHm).toEqual([9, 0]);
		expect(tt.rows[0].endHm).toEqual([11, 50]);
		expect(tt.rows[0].weeks).toEqual([1, 2, null, 4]);
		expect(tt.rows[0].extras).toEqual({
			'cán bộ giảng dạy': 'GS.TS A',
			lớp: '1',
			'ghi chú': 'Ghi chú'
		});

		const badWeekday = src.replace('\tCN\t', '\tInvalid\t');
		expect(() => parsePostgrad(badWeekday)).toThrow(ParseError);
		expect(() => parsePostgrad('nothing')).toThrow(TableNotFoundError);
	});
});

describe('5. detectKind & extractMeta', () => {
	it('detects all 5 schedule kinds in tab/newline/NFD/CRLF/NBSP formats and header-only inputs', () => {
		expect(detectKind(PASTE_1_STUDENT_2024)).toBe('sinh viên 2024');
		expect(detectKind(toTabTable(PASTE_1_STUDENT_2024, 'HỌC KỲ', 12))).toBe('sinh viên 2024');
		expect(detectKind(PASTE_2_EXAM_2024)).toBe('exam');
		expect(detectKind(toTabTable(PASTE_2_EXAM_2024, 'Học kỳ', 11))).toBe('exam');

		// Header-only with malformed data row still detects kind cleanly
		expect(
			detectKind(
				'HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC\nbad'
					.normalize('NFD')
					.replace(/ /g, '\u00a0') + '\r\n'
			)
		).toBe('sinh viên 2024');

		expect(
			detectKind(
				'Mã MH\tTên môn học\tTín chỉ\tTC học phí\tNhóm-tổ\tThứ\tTiết\tGiờ học\tPhòng\tCơ sở\tTuần học'
			)
		).toBe('sinh viên');
		expect(detectKind('Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND')).toBe(
			'giảng viên'
		);
		expect(
			detectKind(
				'Cán bộ giảng dạy\tMôn học\tLớp/DS lớp\tThứ\tTiết bắt đầu\tTiết kết thúc\tPhòng\tTuần\tGhi chú'
			)
		).toBe('sau đại học');
	});

	it('throws TableNotFoundError on unrecognized or empty input', () => {
		expect(() => detectKind('')).toThrow(TableNotFoundError);
		expect(() => detectKind('random text\nwithout header')).toThrow(TableNotFoundError);
	});

	it('extracts student metadata and pagination across NFC/NFD/CRLF/NBSP', () => {
		expect(extractMeta(PASTE_1_STUDENT_2024)).toEqual({
			studentName: 'SINH VIÊN MẪU',
			studentId: 'DEMO-STUDENT-ID',
			pagination: { shownFrom: 1, shown: 10, total: 13 }
		});
		expect(extractMeta(PASTE_2_EXAM_2024)).toEqual({
			studentName: 'SINH VIÊN MẪU',
			studentId: 'DEMO-STUDENT-ID',
			pagination: { shownFrom: 1, shown: 9, total: 9 }
		});

		const nfdPage2 =
			'Họ\u00a0tên: MẪU KHÔNG CÓ MÃ\r\nTrình bày từ dòng 11 đến 13 / 13 dòng'.normalize('NFD');
		expect(extractMeta(nfdPage2)).toEqual({
			studentName: 'MẪU KHÔNG CÓ MÃ',
			pagination: { shownFrom: 11, shown: 13, total: 13 }
		});

		expect(extractMeta('plain text')).toEqual({});
	});
});

describe('6. mergeTimetables', () => {
	it('throws on empty array, mismatched semesters, and conflicting startMondayUTC', () => {
		expect(() => mergeTimetables([])).toThrow();
		expect(() =>
			mergeTimetables([
				{ semester: 261, rows: [] },
				{ semester: 252, rows: [] }
			])
		).toThrow();
		expect(() =>
			mergeTimetables([
				{ semester: 261, startMondayUTC: new Date('2026-08-24T00:00:00Z'), rows: [] },
				{ semester: 261, startMondayUTC: new Date('2026-08-31T00:00:00Z'), rows: [] }
			])
		).toThrow(MixedSemesterError);
	});

	it('merges Paste #1 and Paste #2 preserving CO2011 split rows, 9 exams, and 10 / 13 truncation notice', () => {
		const tt1 = parseStudent2024(PASTE_1_STUDENT_2024);
		tt1.metadata = extractMeta(PASTE_1_STUDENT_2024);
		resolve(tt1);

		const tt2 = parseExam2024(PASTE_2_EXAM_2024);
		tt2.metadata = extractMeta(PASTE_2_EXAM_2024);
		resolve(tt2);

		const merged = mergeTimetables([tt1, tt2]);
		expect(merged.semester).toBe(261);
		expect(merged.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');
		expect(merged.rows).toHaveLength(9);
		expect(merged.exams).toHaveLength(9);
		expect(merged.metadata).toEqual({
			studentName: 'SINH VIÊN MẪU',
			studentId: 'DEMO-STUDENT-ID',
			pagination: { shownFrom: 1, shown: 10, total: 13 }
		});
	});

	it('deduplicates identical overlapping paginated rows and merges pagination intervals to 13 / 13', () => {
		const tt1 = parseStudent2024(PASTE_1_STUDENT_2024);
		tt1.metadata = extractMeta(PASTE_1_STUDENT_2024);
		resolve(tt1);

		const page2: Timetable = {
			semester: 261,
			startMondayUTC: new Date('2026-08-24T00:00:00.000Z'),
			rows: [
				// Duplicate of CO2011 part 1
				{ ...tt1.rows[7], extras: { ...tt1.rows[7].extras } },
				// New row differing only in weeks
				{ ...tt1.rows[7], weeks: [35, 36], extras: { ...tt1.rows[7].extras } }
			],
			metadata: {
				studentName: 'SINH VIÊN MẪU',
				studentId: 'DEMO-STUDENT-ID',
				pagination: { shownFrom: 11, shown: 13, total: 13 }
			}
		};

		const merged = mergeTimetables([tt1, page2]);
		expect(merged.rows).toHaveLength(10);
		expect(merged.metadata?.pagination).toEqual({ shownFrom: 1, shown: 13, total: 13 });
	});

	it('deduplicates exams by (rawCourse, group, date, examType, startHm, room)', () => {
		const tt2 = parseExam2024(PASTE_2_EXAM_2024);
		const dup = parseExam2024(PASTE_2_EXAM_2024);
		dup.exams![0] = { ...dup.exams![0], room: 'B4-999' }; // different room -> kept

		const merged = mergeTimetables([tt2, dup]);
		expect(merged.exams).toHaveLength(10);
	});

	it('retains complete 1..10/10 class pagination when merged with an empty exams: [] 0/0 paste', () => {
		const classTt: Timetable = {
			semester: 261,
			startMondayUTC: new Date('2026-08-24T00:00:00.000Z'),
			rows: parseStudent2024(PASTE_1_STUDENT_2024).rows,
			metadata: {
				studentName: 'SINH VIÊN MẪU',
				studentId: 'DEMO-STUDENT-ID',
				pagination: { shownFrom: 1, shown: 10, total: 10 }
			}
		};
		const emptyExamTt: Timetable = {
			semester: 261,
			rows: [],
			exams: [],
			metadata: {
				pagination: { shownFrom: 0, shown: 0, total: 0 }
			}
		};

		const merged = mergeTimetables([classTt, emptyExamTt]);
		expect(merged.metadata?.pagination).toEqual({ shownFrom: 1, shown: 10, total: 10 });
		expect(merged.exams).toEqual([]);
	});
});

describe('7. formatter/ical.ts', () => {
	it('formats Paste #1 classes with CRLF, escaped \\n in DESCRIPTION, RRULE/EXDATE, and midnight safety', () => {
		const tt1 = parseStudent2024(PASTE_1_STUDENT_2024);
		resolve(tt1);

		const ics = formatIcal(tt1);
		expect(ics.includes('\r\n')).toBe(true);
		const lines = ics.split('\r\n');
		expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(9);
		expect(lines.some((l) => l.startsWith('DESCRIPTION:mã môn học: SP1033\\ntín chỉ: 2'))).toBe(
			true
		);
		expect(lines.some((l) => l.startsWith('RRULE:FREQ=WEEKLY;UNTIL='))).toBe(true);
		expect(lines.some((l) => l === 'EXDATE;TZID=Asia/Ho_Chi_Minh')).toBe(true);

		// Midnight formatting in HCM (must be T000000, never T240000)
		const midnightUtc = hcmDateToUtc('2026-12-28', [0, 15]);
		expect(formatHCM(midnightUtc)).toBe('20261228T001500');
		expect(formatHCMRfc3339(midnightUtc)).toBe('2026-12-28T00:15:00+07:00');
		expect(formatUTC(new Date('2026-12-28T00:15:00Z'))).toBe('20261228T001500Z');
	});

	it('formats Paste #2 exams without startMondayUTC, with VALARM -P1D/-PT60M, no RRULE, and supports scopes', () => {
		const tt1 = parseStudent2024(PASTE_1_STUDENT_2024);
		resolve(tt1);
		const tt2 = parseExam2024(PASTE_2_EXAM_2024);
		resolve(tt2);

		const examOnlyIcs = formatIcal(tt2);
		const examLines = examOnlyIcs.split('\r\n');
		expect(examLines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(9);
		expect(examLines.some((l) => l.startsWith('RRULE:'))).toBe(false);
		expect(examLines).toContain('SUMMARY:[CK] CO2011 - Mô hình hóa Toán học');
		expect(examLines).toContain('LOCATION:B4-305 (BK-CS1)');
		expect(examLines).toContain('DTSTART;TZID=Asia/Ho_Chi_Minh:20261228T070000');
		expect(examLines).toContain('DTEND;TZID=Asia/Ho_Chi_Minh:20261228T082000');
		expect(examLines.filter((l) => l === 'TRIGGER:-P1D')).toHaveLength(9);
		expect(examLines.filter((l) => l === 'TRIGGER:-PT60M')).toHaveLength(9);

		const customReminderIcs = formatIcal(tt2, { examRemindersMinutes: [30] });
		expect(customReminderIcs).toContain('TRIGGER:-PT30M');
		expect(customReminderIcs).not.toContain('TRIGGER:-P1D');

		const noReminderIcs = formatIcal(tt2, { examRemindersMinutes: [] });
		expect(noReminderIcs).not.toContain('BEGIN:VALARM');

		const merged = mergeTimetables([tt1, tt2]);
		expect(formatIcal(merged, { scope: 'all' }).split('BEGIN:VEVENT').length - 1).toBe(18);
		expect(formatIcal(merged, { scope: 'classes' }).split('BEGIN:VEVENT').length - 1).toBe(9);
		expect(formatIcal(merged, { scope: 'exams' }).split('BEGIN:VEVENT').length - 1).toBe(9);
	});

	it('handles blank dash fields cleanly in formatExamLocation & formatExamDescription', () => {
		const exam: ExamRow = {
			semester: 261,
			courseCode: 'X',
			courseName: 'Y',
			rawCourse: 'X - Y',
			group: 'L01',
			date: '2026-12-28',
			examType: 'CK',
			campus: '--',
			room: '- - -',
			weekday: 2,
			startHm: [7, 0],
			endHm: [8, 0],
			durationMinutes: 60,
			updatedAt: ''
		};
		expect(formatExamLocation(exam)).toBe('');
		expect(formatExamSummary(exam)).toBe('[CK] X - Y');
		expect(formatExamDescription(exam)).toBe('Loại thi: CK\nNhóm lớp: L01\nThời lượng: 60 phút');
	});

	it('escapes newlines in SUMMARY, LOCATION, and VALARM DESCRIPTION for programmatic ExamRow and Timerow', () => {
		const tt: Timetable = {
			semester: 261,
			startMondayUTC: new Date('2026-08-24T00:00:00.000Z'),
			rows: [
				{
					name: 'Class Line 1\nSUMMARY:FAKE',
					weekday: 2,
					startHm: [9, 0],
					endHm: [10, 50],
					weeks: [35],
					location: 'C5\r\nLOCATION:FAKE',
					extras: { note: 'a\nb' }
				}
			],
			exams: [
				{
					semester: 261,
					courseCode: 'X1',
					courseName: 'Test\nSUMMARY:FAKE',
					rawCourse: 'X1 - Test\nSUMMARY:FAKE',
					group: 'L01',
					date: '2026-12-28',
					examType: 'CK',
					campus: 'BK-CS1',
					room: 'B4-305\nLOCATION:FAKE',
					weekday: 2,
					startHm: [7, 0],
					endHm: [8, 20],
					durationMinutes: 80,
					updatedAt: '2026-10-23 10:10:00'
				}
			]
		};

		const ics = formatIcal(tt);
		const lines = ics.split('\r\n');
		expect(lines).not.toContain('SUMMARY:FAKE');
		expect(lines).not.toContain('LOCATION:FAKE');
		expect(lines).toContain('SUMMARY:Class Line 1\\nSUMMARY:FAKE');
		expect(lines).toContain('LOCATION:C5\\nLOCATION:FAKE');
		expect(lines).toContain('SUMMARY:[CK] X1 - Test\\nSUMMARY:FAKE');
		expect(lines).toContain('LOCATION:B4-305\\nLOCATION:FAKE (BK-CS1)');
		expect(lines.filter((l) => l === 'DESCRIPTION:[CK] X1 - Test\\nSUMMARY:FAKE')).toHaveLength(2);
	});
});

describe('8. formatter/gapi.ts', () => {
	it('formats combined and split GAPI events with reminders and no recurrence on exams', () => {
		const tt1 = parseStudent2024(PASTE_1_STUDENT_2024);
		resolve(tt1);
		const tt2 = parseExam2024(PASTE_2_EXAM_2024);
		resolve(tt2);
		const merged = mergeTimetables([tt1, tt2]);

		const split = formatGapiSplit(merged);
		expect(split.classEvents).toHaveLength(9);
		expect(split.examEvents).toHaveLength(9);

		const all = formatGapi(merged);
		expect(all).toHaveLength(18);

		const firstExam = split.examEvents[0];
		expect(firstExam.summary).toBe('[CK] CO2011 - Mô hình hóa Toán học');
		expect(firstExam.location).toBe('B4-305 (BK-CS1)');
		expect(firstExam.start).toEqual({
			dateTime: '2026-12-28T00:00:00.000Z',
			timeZone: ASIA_HO_CHI_MINH
		});
		expect(firstExam.end).toEqual({
			dateTime: '2026-12-28T01:20:00.000Z',
			timeZone: ASIA_HO_CHI_MINH
		});
		expect('recurrence' in firstExam).toBe(false);
		expect(firstExam.reminders).toEqual({
			useDefault: false,
			overrides: [
				{ method: 'popup', minutes: 1440 },
				{ method: 'popup', minutes: 60 }
			]
		});
	});

	it('generates Google Calendar TEMPLATE URLs with UTC timestamps and HCM ctz', () => {
		const tt2 = parseExam2024(PASTE_2_EXAM_2024);
		const url = new URL(formatGoogleCalendarTemplateUrl(tt2.exams![0]));
		expect(`${url.origin}${url.pathname}`).toBe('https://calendar.google.com/calendar/render');
		expect(url.searchParams.get('action')).toBe('TEMPLATE');
		expect(url.searchParams.get('text')).toBe('[CK] CO2011 - Mô hình hóa Toán học');
		expect(url.searchParams.get('dates')).toBe('20261228T000000Z/20261228T012000Z');
		expect(url.searchParams.get('location')).toBe('B4-305 (BK-CS1)');
		expect(url.searchParams.get('ctz')).toBe(ASIA_HO_CHI_MINH);
		expect(url.searchParams.get('details')).toContain('Loại thi: CK');

		// Early-morning 00:30 HCM rolls back to previous UTC day
		const earlyExam: ExamRow = {
			...tt2.exams![0],
			date: '2026-12-28',
			startHm: [0, 30],
			endHm: [1, 30],
			durationMinutes: 60
		};
		const earlyUrl = new URL(formatGoogleCalendarTemplateUrl(earlyExam));
		expect(earlyUrl.searchParams.get('dates')).toBe('20261227T173000Z/20261227T183000Z');
	});
});

describe('9. cross-process TZ invariance', () => {
	async function bundleDataUrl(
		relPath: string,
		replacements: Record<string, string>
	): Promise<string> {
		const src = readFileSync(resolvePath(relPath), 'utf8');
		let js = (await transformWithEsbuild(src, relPath)).code;
		for (const [specifier, dataUrl] of Object.entries(replacements)) {
			js = js
				.replaceAll(`'${specifier}'`, JSON.stringify(dataUrl))
				.replaceAll(`"${specifier}"`, JSON.stringify(dataUrl));
		}
		return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
	}

	function normalizeIcs(ics: string): string {
		return ics.replace(/^UID:.*$/gm, 'UID:MASKED').replace(/^DTSTAMP:.*$/gm, 'DTSTAMP:MASKED');
	}

	async function runCorePipelineInChildTz(tz: string) {
		const constantsUrl = await bundleDataUrl('src/lib/core/constants.ts', {});
		const errorsUrl = await bundleDataUrl('src/lib/core/parser/errors.ts', {});
		const parserUtilsUrl = await bundleDataUrl('src/lib/core/parser/utils.ts', {
			'./errors': errorsUrl
		});
		const resolverUrl = await bundleDataUrl('src/lib/core/resolver.ts', {
			'./constants': constantsUrl
		});
		const student2024Url = await bundleDataUrl('src/lib/core/parser/student_2024.ts', {
			'./errors': errorsUrl,
			'./utils': parserUtilsUrl
		});
		const exam2024Url = await bundleDataUrl('src/lib/core/parser/exam_2024.ts', {
			'./errors': errorsUrl,
			'./student_2024': student2024Url,
			'./utils': parserUtilsUrl
		});
		const detectUrl = await bundleDataUrl('src/lib/core/detect.ts', {
			'./parser/errors': errorsUrl,
			'./resolver': resolverUrl
		});
		const fmtUtilsUrl = await bundleDataUrl('src/lib/core/formatter/utils.ts', {
			'../constants': constantsUrl
		});
		const icalUrl = await bundleDataUrl('src/lib/core/formatter/ical.ts', {
			'../constants': constantsUrl,
			'../resolver': resolverUrl,
			'./utils': fmtUtilsUrl
		});
		const gapiUrl = await bundleDataUrl('src/lib/core/formatter/gapi.ts', {
			'../constants': constantsUrl,
			'../resolver': resolverUrl,
			'./ical': icalUrl,
			'./utils': fmtUtilsUrl
		});

		const runner = `
			import { parseStudent2024 } from ${JSON.stringify(student2024Url)};
			import { parseExam2024 } from ${JSON.stringify(exam2024Url)};
			import { detectKind, extractMeta, mergeTimetables } from ${JSON.stringify(detectUrl)};
			import { resolve } from ${JSON.stringify(resolverUrl)};
			import { formatIcal } from ${JSON.stringify(icalUrl)};
			import { formatGapi, formatGoogleCalendarTemplateUrl } from ${JSON.stringify(gapiUrl)};

			const p1 = ${JSON.stringify(PASTE_1_STUDENT_2024)};
			const p2 = ${JSON.stringify(PASTE_2_EXAM_2024)};
			const nativeGetDay = new Date(Date.UTC(2026, 7, 30, 0, 0, 0)).getDay();

			const kind1 = detectKind(p1);
			const kind2 = detectKind(p2);
			const t1 = parseStudent2024(p1);
			t1.metadata = extractMeta(p1);
			resolve(t1);
			const t2 = parseExam2024(p2);
			t2.metadata = extractMeta(p2);
			resolve(t2);
			const merged = mergeTimetables([t1, t2]);

			console.log(JSON.stringify({
				nativeGetDay,
				kind1,
				kind2,
				startMondayUTC: merged.startMondayUTC?.toISOString(),
				gapi: formatGapi(merged),
				templateUrl: formatGoogleCalendarTemplateUrl(merged.exams[0]),
				ics: formatIcal(merged)
			}));
		`;

		const stdout = execFileSync(process.execPath, ['--input-type=module'], {
			input: runner,
			env: { ...process.env, TZ: tz },
			encoding: 'utf8'
		});
		return JSON.parse(stdout.trim()) as {
			nativeGetDay: number;
			kind1: string;
			kind2: string;
			startMondayUTC: string;
			gapi: unknown[];
			templateUrl: string;
			ics: string;
		};
	}

	it('produces identical outputs under TZ=America/New_York and TZ=Asia/Ho_Chi_Minh', async () => {
		const ny = await runCorePipelineInChildTz('America/New_York');
		const hcm = await runCorePipelineInChildTz('Asia/Ho_Chi_Minh');

		expect(ny.nativeGetDay).toBe(6);
		expect(hcm.nativeGetDay).toBe(0);
		expect(ny.nativeGetDay).not.toBe(hcm.nativeGetDay);

		expect(ny.kind1).toBe(hcm.kind1);
		expect(ny.kind2).toBe(hcm.kind2);
		expect(ny.startMondayUTC).toBe(hcm.startMondayUTC);
		expect(ny.gapi).toEqual(hcm.gapi);
		expect(ny.templateUrl).toBe(hcm.templateUrl);
		expect(normalizeIcs(ny.ics)).toBe(normalizeIcs(hcm.ics));
	});
});
