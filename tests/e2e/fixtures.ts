import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ExamRow, ParseMetadata, Timerow, Timetable } from '$lib/core/timetable';

export type { ExamRow, ParseMetadata, Timerow, Timetable };

export type ScheduleKind = 'exam' | 'sinh viên 2024' | 'sinh viên' | 'giảng viên' | 'sau đại học';

export type GapiEvent = {
	summary: string;
	description?: string;
	location?: string;
	start: { dateTime: string; timeZone: string };
	end: { dateTime: string; timeZone: string };
	recurrence?: string[];
	colorId?: string;
	reminders?: {
		useDefault: boolean;
		overrides?: { method: string; minutes: number }[];
	};
};

export type IcalOptions = {
	scope?: 'all' | 'classes' | 'exams';
	examRemindersMinutes?: number[];
};

export type GapiOptions = {
	examRemindersMinutes?: number[];
};

export type GapiSplitResult = {
	classEvents: GapiEvent[];
	examEvents: GapiEvent[];
};

export type ConstantsExports = {
	MINUTE: number;
	HOUR: number;
	DAY: number;
	WEEK: number;
	ASIA_HO_CHI_MINH: unknown;
};

export type ErrorsExports = {
	ParseError: new (src: string, message: string) => Error & { src: string };
	SemesterNotFoundError: new (src: string) => Error & { src: string };
	NumOfColumnMismatchError: new (
		src: string,
		expected: number,
		found: number
	) => Error & { src: string; expected: number; found: number };
	TableNotFoundError: new (src: string) => Error & { src: string };
};

export type ParserUtilsExports = {
	parseTime: (src: string) => [number, number] | null | undefined;
	hmFrom: (tiet: number) => { startHm: [number, number]; endHm: [number, number] };
	parseExamTime: (src: string) => [number, number];
	addMinutesToHm: (hm: [number, number], minutes: number) => [number, number];
	extractTableRows?: (...args: unknown[]) => unknown;
};

export type ResolverExports = {
	resolve: (timetable: Timetable) => void;
	isUnresolvable: (timerow: Timerow) => boolean;
	dayOfWeek: (d: number) => number;
	MixedSemesterError: new (doiz1: Date, doiz2: Date) => Error & { doiz1: Date; doiz2: Date };
	UnresolvedError: new () => Error;
	findIndex0AndWeek1: (weeks: (number | null)[]) => {
		weekOfIndex0: number | undefined;
		indexOfWeek1: number | undefined;
	};
	findMondayOfIndex0: (
		indexOfWeek1: number | undefined,
		weekOfIndex0: number | undefined,
		semester: number
	) => Date;
};

export type DetectExports = {
	detectKind: (src: string) => ScheduleKind;
	extractMeta: (src: string) => ParseMetadata;
	mergeTimetables: (timetables: Timetable[]) => Timetable;
};

export type Student2024Exports = {
	parseStudent2024: (src: string) => Timetable;
};

export type Exam2024Exports = {
	parseExam2024: (src: string) => Timetable;
};

export type StudentExports = {
	parseStudent: (src: string) => Timetable;
};

export type LecturerExports = {
	parseLecturer: (src: string) => Timetable;
};

export type PostgradExports = {
	parsePostgrad: (src: string) => Timetable;
};

export type IcalExports = {
	formatIcal: (timetable: Timetable, options?: IcalOptions) => string;
	icalRrule?: (...args: unknown[]) => string;
};

export type GapiExports = {
	formatGapi: (timetable: Timetable, options?: GapiOptions) => GapiEvent[];
	formatGapiSplit: (timetable: Timetable, options?: GapiOptions) => GapiSplitResult;
	formatGoogleCalendarTemplateUrl: (exam: ExamRow) => string;
};

export type ModExports = Student2024Exports &
	Exam2024Exports &
	StudentExports &
	LecturerExports &
	PostgradExports &
	DetectExports &
	ResolverExports &
	IcalExports &
	GapiExports &
	ErrorsExports &
	ConstantsExports;

export type ColorsExports = {
	COLORS: Map<string, { background: string }>;
	EXAM_TOMATO_COLOR_ID: string;
	randomColorIds: (size: number) => Iterable<string>;
	courseColorIds: (events: GapiEvent[]) => string[];
};

export type GoogleExports = {
	DEFAULT_CLIENT_ID: string;
	[key: string]: unknown;
};

export type SvelteComponentModule = {
	default: {
		render: (props?: Record<string, unknown>) => {
			html: string;
			css: { code: string; map: unknown };
			head: string;
		};
	};
};

export const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const libModules = import.meta.glob<Record<string, unknown>>('/src/lib/**/*.{ts,svelte}');
const routeModules = import.meta.glob<Record<string, unknown>>('/src/routes/**/*.{ts,svelte}');

function normalizeLibPath(subpath: string): string {
	return subpath.startsWith('/src/lib/') ? subpath : `/src/lib/${subpath.replace(/^\/+/, '')}`;
}

function normalizeRoutePath(subpath: string): string {
	return subpath.startsWith('/src/routes/')
		? subpath
		: `/src/routes/${subpath.replace(/^\/+/, '')}`;
}

export function hasLibModule(subpath: string): boolean {
	return Boolean(libModules[normalizeLibPath(subpath)]);
}

export function hasRouteModule(subpath: string): boolean {
	return Boolean(routeModules[normalizeRoutePath(subpath)]);
}

export async function loadLibModule<T = Record<string, unknown>>(subpath: string): Promise<T> {
	const fullPath = normalizeLibPath(subpath);
	const loader = libModules[fullPath];
	if (!loader) {
		throw new Error(`Required module not yet implemented: ${fullPath}`);
	}
	return (await loader()) as T;
}

export async function loadRouteModule<T = Record<string, unknown>>(subpath: string): Promise<T> {
	const fullPath = normalizeRoutePath(subpath);
	const loader = routeModules[fullPath];
	if (!loader) {
		throw new Error(`Required module not yet implemented: ${fullPath}`);
	}
	return (await loader()) as T;
}

export function runInTimezone<T>(tz: string, scriptBody: string): T {
	const marker = '__E2E_TZ_RESULT__';
	const childScript = `
import { createServer } from 'vite';
const server = await createServer({
	server: { middlewareMode: true },
	appType: 'custom',
	logLevel: 'silent'
});
try {
	const run = async (server) => {
		${scriptBody}
	};
	const result = await run(server);
	console.log(${JSON.stringify(marker)} + JSON.stringify(result));
} finally {
	await server.close();
}
`;
	const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', childScript], {
		cwd: WORKSPACE_ROOT,
		env: { ...process.env, TZ: tz },
		encoding: 'utf8'
	});
	const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith(marker));
	if (!line) {
		throw new Error(`Missing TZ subprocess output marker (${tz}). Raw stdout:\n${stdout}`);
	}
	return JSON.parse(line.slice(marker.length)) as T;
}

export function defaultCalendarName(tt: Pick<Timetable, 'semester' | 'rows' | 'exams'>): string {
	const prefix = tt.rows.length === 0 && (tt.exams?.length ?? 0) > 0 ? 'THI' : 'SV';
	return `${prefix}${tt.semester}`;
}

export function normalizeIcalVolatileFields(ics: string): string {
	return ics
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => {
			if (line.startsWith('UID:')) return 'UID:<NORMALIZED>';
			if (line.startsWith('DTSTAMP:')) return 'DTSTAMP:<NORMALIZED>';
			return line;
		})
		.join('\n');
}

export function unfoldIcal(ics: string): string {
	return ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

export function rowMatchesCourse(row: Timerow, code: string, nameSub: string): boolean {
	if (!row.name.includes(nameSub)) return false;
	if (row.name.includes(code)) return true;
	return Object.values(row.extras ?? {}).some((v) => String(v).includes(code));
}

export function readWorkspaceText(relPath: string): string {
	return fs.readFileSync(path.join(WORKSPACE_ROOT, relPath), 'utf8');
}

export function workspaceExists(relPath: string): boolean {
	return fs.existsSync(path.join(WORKSPACE_ROOT, relPath));
}

export function collectFilesRecursive(dirRel: string, exts?: string[]): string[] {
	const root = path.join(WORKSPACE_ROOT, dirRel);
	if (!fs.existsSync(root)) return [];
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (!exts || exts.some((ext) => entry.name.endsWith(ext))) {
				out.push(full);
			}
		}
	};
	walk(root);
	return out;
}

const PASTE_1_SELECT_LINE =
	'Tất cả học kì99992 - Học kỳ Nhập điểm Thi Lại99991 - Học kỳ Nhập điểm Bảo Lưu, Miễn20291 - Học kỳ 1 Năm học 2029 - 203020283 - Học kỳ 3 Năm học 2028 - 202920282 - Học kỳ 2 Năm học 2028 - 202920281 - Học kỳ 1 Năm học 2028 - 202920273 - Học kỳ 3 Năm học 2027 - 202820272 - Học kỳ 2 Năm học 2027 - 202820271 - Học kỳ 1 Năm học 2027 - 202820263 - Học kỳ 3 Năm học 2026 - 202720262 - Học kỳ 2 Năm học 2026 - 202720261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)20253 - Học kỳ 3 Năm học 2025 - 202620252 - Học kỳ 2 Năm học 2025 - 202620251 - Học kỳ 1 Năm học 2025 - 202620243 - Học kỳ 3 Năm học 2024 - 202520242 - Học kỳ 2 Năm học 2024 - 202520241 - Học kỳ 1 Năm học 2024 - 202520233 - Học kỳ 3 Năm học 2023 - 202420232 - Học kỳ 2 Năm học 2023 - 202420231 - Học kỳ 1 Năm học 2023 - 202420223 - Học kỳ 3 Năm học 2022 - 202320222 - Học kỳ 2 Năm học 2022 - 202320221 - Học kỳ 1 Năm học 2022 - 202320213 - Học kỳ 3 Năm học 2021 - 202220212 - Học kỳ 2 Năm học 2021 - 202220211 - Học kỳ 1 Năm học 2021 - 202220204 - Học kỳ 4 Năm học 2020 - 2021 (ThiLai-HoanThi)20203 - Học kỳ 3 Năm học 2020 - 202120202 - Học kỳ 2 Năm học 2020 - 202120201 - Học kỳ 1 Năm học 2020 - 202120193 - Học kỳ 3 Năm học 2019 - 202020192 - Học kỳ 2 Năm học 2019 - 202020191 - Học kỳ 1 Năm học 2019 - 202020183 - Học kỳ 3 Năm học 2018 - 201920182 - Học kỳ 2 Năm học 2018 - 201920181 - Học kỳ 1 Năm học 2018 - 201920173 - Học kỳ 3 Năm học 2017 - 201820172 - Học kỳ 2 Năm học 2017 - 201820171 - Học kỳ 1 Năm học 2017 - 201820163 - Học kỳ 3 Năm học 2016 - 201720162 - Học kỳ 2 Năm học 2016 - 201720161 - Học kỳ 1 Năm học 2016 - 201720153 - Học kỳ 3 Năm học 2015 - 201620152 - Học kỳ 2 Năm học 2015 - 201620151 - Học kỳ 1 Năm học 2015 - 201620143 - Học kỳ 3 Năm học 2014 - 201520142 - Học kỳ 2 Năm học 2014 - 201520141 - Học kỳ 1 Năm học 2014 - 201520133 - Học kỳ 3 Năm học 2013 - 201420132 - Học kỳ 2 Năm học 2013 - 201420131 - Học kỳ 1 Năm học 2013 - 201420123 - Học kỳ 3 Năm học 2012 - 201320122 - Học kỳ 2 Năm học 2012 - 201320121 - Học kỳ 1 Năm học 2012 - 201320113 - Học kỳ 3 Năm học 2011 - 201220112 - Học kỳ 2 Năm học 2011 - 201220111 - Học kỳ 1 Năm học 2011 - 201220103 - Học kỳ 3 Năm học 2010 - 201120102 - Học kỳ 2 Năm học 2010 - 201120101 - Học kỳ 1 Năm học 2010 - 201120093 - Học kỳ 3 Năm học 2009 - 201020092 - Học kỳ 2 Năm học 2009 - 201020091 - Học kỳ 1 Năm học 2009 - 201020083 - Học kỳ 3 Năm học 2008 - 200920082 - Học kỳ 2 Năm học 2008 - 200920081 - Học kỳ 1 Năm học 2008 - 200920073 - Học kỳ 3 Năm học 2007 - 200820072 - Học kỳ 2 Năm học 2007 - 200820071 - Học kỳ 1 Năm học 2007 - 200820063 - Học kỳ 3 Năm học 2006 - 200720062 - Học kỳ 2 Năm học 2006 - 200720061 - Học kỳ 1 Năm học 2006 - 200720053 - Học kỳ 3 Năm học 2005 - 200620052 - Học kỳ 2 Năm học 2005 - 200620051 - Học kỳ 1 Năm học 2005 - 200620043 - Học kỳ 3 Năm học 2004 - 200520042 - Học kỳ 2 Năm học 2004 - 200520041 - Học kỳ 1 Năm học 2004 - 200520033 - Học kỳ 3 Năm học 2003 - 200420032 - Học kỳ 2 Năm học 2003 - 200420031 - Học kỳ 1 Năm học 2003 - 200420023 - Học kỳ 3 Năm học 2002 - 200320022 - Học kỳ 2 Năm học 2002 - 200320021 - Học kỳ 1 Năm học 2002 - 200320013 - Học kỳ 3 Năm học 2001 - 200220012 - Học kỳ 2 Năm học 2001 - 200220011 - Học kỳ 1 Năm học 2001 - 200220003 - Học kỳ 3 Năm học 2000 - 200120002 - Học kỳ 2 Năm học 2000 - 200120001 - Học kỳ 1 Năm học 2000 - 200119993 - Học kỳ 3 Năm học 1999 - 200019992 - Học kỳ 2 Năm học 1999 - 200019991 - Học kỳ 1 Năm học 1999 - 200019983 - Học kỳ 3 Năm học 1998 - 199919982 - Học kỳ 2 Năm học 1998 - 199919981 - Học kỳ 1 Năm học 1998 - 199919973 - Học kỳ 3 Năm học 1997 - 199819972 - Học kỳ 2 Năm học 1997 - 199819971 - Học kỳ 1 Năm học 1997 - 199819963 - Học kỳ 3 Năm học 1996 - 199719962 - Học kỳ 2 Năm học 1996 - 199719961 - Học kỳ 1 Năm học 1996 - 199719953 - Học kỳ 3 Năm học 1995 - 199619952 - Học kỳ 2 Năm học 1995 - 199619951 - Học kỳ 1 Năm học 1995 - 199619943 - Học kỳ 3 Năm học 1994 - 199519942 - Học kỳ 2 Năm học 1994 - 199519941 - Học kỳ 1 Năm học 1994 - 199519933 - Học kỳ 3 Năm học 1993 - 199419932 - Học kỳ 2 Năm học 1993 - 199419931 - Học kỳ 1 Năm học 1993 - 199419923 - Học kỳ 3 Năm học 1992 - 199319922 - Học kỳ 2 Năm học 1992 - 199319921 - Học kỳ 1 Năm học 1992 - 199319913 - Học kỳ 3 Năm học 1991 - 199219912 - Học kỳ 2 Năm học 1991 - 199219911 - Học kỳ 1 Năm học 1991 - 199219903 - Học kỳ 3 Năm học 1990 - 199119902 - Học kỳ 2 Năm học 1990 - 199119901 - Học kỳ 1 Năm học 1990 - 1991';

const PASTE_2_SELECT_LINE =
	'Tất cả học kì99992 - Học kỳ Nhập điểm Thi Lại99991 - Học kỳ Nhập điểm Bảo Lưu, Miễn20291 - Học kỳ 1 Năm học 2029 - 203020283 - Học kỳ 3 Năm học 2028 - 202920282 - Học kỳ 2 Năm học 2028 - 202920281 - Học kỳ 1 Năm học 2028 - 202920273 - Học kỳ 3 Năm học 2027 - 202820272 - Học kỳ 2 Năm học 2027 - 202820271 - Học kỳ 1 Năm học 2027 - 202820263 - Học kỳ 3 Năm học 2026 - 202720262 - Học kỳ 2 Năm học 2026 - 202720261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)20253 - Học kỳ 3 Năm học 2025 - 202620252 - Học kỳ 2 Năm học 2025 - 202620251 - Học kỳ 1 Năm học 2025 - 202620243 - Học kỳ 3 Năm học 2024 - 202520242 - Học kỳ 2 Năm học 2024 - 202520241 - Học kỳ 1 Năm học 2024 - 202520233 - Học kỳ 3 Năm học 2023 - 202420232 - Học kỳ 2 Năm học 2023 - 202420231 - Học kỳ 1 Năm học 2023 - 202420223 - Học kỳ 3 Năm học 2022 - 202320222 - Học kỳ 2 Năm học 2022 - 202320221 - Học kỳ 1 Năm học 2022 - 202320213 - Học kỳ 3 Năm học 2021 - 202220212 - Học kỳ 2 Năm học 2021 - 202220211 - Học kỳ 1 Năm học 2021 - 202220204 - Học kỳ 4 Năm học 2020 - 2021 (ThiLai-HoanThi)20203 - Học kỳ 3 Năm học 2020 - 202120202 - Học kỳ 2 Năm học 2020 - 202120201 - Học kỳ 1 Năm học 2020 - 202120193 - Học kỳ 3 Năm học 2019 - 202020192 - Học kỳ 2 Năm học 2019 - 202020191 - Học kỳ 1 Năm học 2019 - 202020183 - Học kỳ 3 Năm học 2018 - 201920182 - Học kỳ 2 Năm học 2018 - 201920181 - Học kỳ 1 Năm học 2018 - 201920173 - Học kỳ 3 Năm học 2017 - 201820172 - Học kỳ 2 Năm học 2017 - 201820171 - Học kỳ 1 Năm học 2017 - 201820163 - Học kỳ 3 Năm học 2016 - 201720162 - Học kỳ 2 Năm học 2016 - 201720161 - Học kỳ 1 Năm học 2016 - 201720153 - Học kỳ 3 Năm học 2015 - 201620152 - Học kỳ 2 Năm học 2015 - 201620151 - Học kỳ 1 Năm học 2015 - 201620143 - Học kỳ 3 Năm học 2014 - 201520142 - Học kỳ 2 Năm học 2014 - 201520141 - Học kỳ 1 Năm học 2014 - 201520133 - Học kỳ 3 Năm học 2013 - 201420132 - Học kỳ 2 Năm học 2013 - 201420131 - Học kỳ 1 Năm học 2013 - 201420123 - Học kỳ 3 Năm học 2012 - 201320122 - Học kỳ 2 Năm học 2012 - 201320121 - Học kỳ 1 Năm học 2012 - 201320113 - Học kỳ 3 Năm học 2011 - 201220112 - Học kỳ 2 Năm học 2011 - 201220111 - Học kỳ 1 Năm học 2011 - 201220103 - Học kỳ 3 Năm học 2010 - 201120102 - Học kỳ 2 Năm học 2010 - 201120101 - Học kỳ 1 Năm học 2010 - 201120093 - Học kỳ 3 Năm học 2009 - 201020092 - Học kỳ 2 Năm học 2009 - 201020091 - Học kỳ 1 Năm học 2009 - 201020083 - Học kỳ 3 Năm học 2008 - 200920082 - Học kỳ 2 Năm học 2008 - 200920081 - Học kỳ 1 Năm học 2008 - 200920073 - Học kỳ 3 Năm học 2007 - 200820072 - Học kỳ 2 Năm học 2007 - 200820071 - Học kỳ 1 Năm học 2007 - 200820063 - Học kỳ 3 Năm học 2006 - 200720062 - Học kỳ 2 Năm học 2006 - 200720061 - Học kỳ 1 Năm học 2006 - 200720053 - Học kỳ 3 Năm học 2005 - 200620052 - Học kỳ 2 Năm học 2005 - 200620051 - Học kỳ 1 Năm học 2005 - 200620043 - Học kỳ 3 Năm học 2004 - 200520042 - Học kỳ 2 Năm học 2004 - 200520041 - Học kỳ 1 Năm học 2004 - 200520033 - Học kỳ 3 Năm học 2003 - 200420032 - Học kỳ 2 Năm học 2003 - 200420031 - Học kỳ 1 Năm học 2003 - 200420023 - Học kỳ 3 Năm học 2002 - 200320022 - Học kỳ 2 Năm học 2002 - 200320021 - Học kỳ 1 Năm học 2002 - 200320013 - Học kỳ 3 Năm học 2001 - 200220012 - Học kỳ 2 Năm học 2001 - 200220011 - Học kỳ 1 Năm học 2001 - 200220003 - Học kỳ 3 Năm học 2000 - 200120002 - Học kỳ 2 Năm học 2000 - 200120001 - Học kỳ 1 Năm học 2000 - 200119993 - Học kỳ 3 Năm học 1999 - 200019992 - Học kỳ 2 Năm học 1999 - 200019991 - Học kỳ 1 Năm học 1999 - 200019983 - Học kỳ 3 Năm học 1998 - 199919982 - Học kỳ 2 Năm học 1998 - 199919981 - Học kỳ 1 Năm học 1998 - 199919973 - Học kỳ 3 Năm học 1997 - 199819972 - Học kỳ 2 Năm học 1997 - 199819971 - Học kỳ 1 Năm học 1997 - 199819963 - Học kỳ 3 Năm học 1996 - 199719962 - Học kỳ 2 Năm học 1996 - 199719961 - Học kỳ 1 Năm học 1996 - 200719953 - Học kỳ 3 Năm học 1995 - 199619952 - Học kỳ 2 Năm học 1995 - 199619951 - Học kỳ 1 Năm học 1995 - 199619943 - Học kỳ 3 Năm học 1994 - 199519942 - Học kỳ 2 Năm học 1994 - 199519941 - Học kỳ 1 Năm học 1994 - 199519933 - Học kỳ 3 Năm học 1993 - 199419932 - Học kỳ 2 Năm học 1993 - 199419931 - Học kỳ 1 Năm học 1993 - 199419923 - Học kỳ 3 Năm học 1992 - 199319922 - Học kỳ 2 Năm học 1992 - 199319921 - Học kỳ 1 Năm học 1992 - 199319913 - Học kỳ 3 Năm học 1991 - 199219912 - Học kỳ 2 Năm học 1991 - 199219911 - Học kỳ 1 Năm học 1991 - 199219903 - Học kỳ 3 Năm học 1990 - 199119902 - Học kỳ 2 Năm học 1990 - 199119901 - Học kỳ 1 Năm học 1990 - 1991';

const PASTE_1_HEADER_COLS = [
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

const PASTE_1_ROWS: string[][] = [
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
	],
	[
		'20261',
		'CO2003',
		'Cấu trúc Dữ liệu và Giải Thuật',
		'4',
		'4',
		'CC01',
		'3',
		'8 - 9',
		'13:00 - 14:50',
		'B1-306',
		'BK-CS1',
		'35|--|37|38|39|40|41|--|43|44|45|46|47|--|49|50|'
	],
	[
		'20261',
		'SK2001',
		'Kỹ năng Tư duy khoa học',
		'0',
		'0',
		'CC52',
		'3',
		'10 - 12',
		'15:00 - 17:50',
		'C5-302',
		'BK-CS1',
		'--|--|--|--|--|--|--|--|--|--|--|46|47|--|49|50|'
	],
	[
		'20261',
		'CH1003',
		'Hóa đại cương',
		'3',
		'3',
		'CC06',
		'3',
		'4 - 5',
		'9:00 - 10:50',
		'C5-303',
		'BK-CS1',
		'35|--|37|38|39|40|41|--|43|44|45|46|47|--|49|50|'
	],
	[
		'20261',
		'CO2008',
		'Kiến trúc Máy tính (Th)',
		'0',
		'0',
		'CC06',
		'4',
		'8 - 12',
		'13:00 - 17:50',
		'C5-202',
		'BK-CS1',
		'--|--|--|--|--|--|41|--|43|--|45|--|47|'
	],
	[
		'20261',
		'CH1004',
		'Hóa đại cương (TN)',
		'0',
		'0',
		'CC11',
		'5',
		'2 - 6',
		'7:00 - 11:50',
		'B2-406',
		'BK-CS1',
		'--|--|--|38|39|40|41|'
	],
	[
		'20261',
		'CO2004',
		'Cấu trúc Dữ liệu và Giải Thuật (Th)',
		'0',
		'0',
		'CC01',
		'5',
		'8 - 12',
		'13:00 - 17:50',
		'C6-102',
		'BK-CS1',
		'--|--|--|38|--|40|--|--|--|44|--|46|--|48|--|50|'
	],
	[
		'20261',
		'CO2011',
		'Mô hình hóa Toán học',
		'3',
		'3',
		'CC02',
		'6',
		'4 - 5',
		'9:00 - 10:50',
		'C5-502',
		'BK-CS1',
		'35|36|37|38|--|--|--|--|43|44|45|'
	],
	[
		'20261',
		'CO2011',
		'Mô hình hóa Toán học',
		'3',
		'3',
		'CC02',
		'6',
		'4 - 5',
		'9:00 - 10:50',
		'C5-502',
		'BK-CS1',
		'--|--|--|--|39|40|41|--|--|--|--|46|47|48|49|50|'
	]
];

const PASTE_1_PREFIX = [
	'[myBk/app](https://mybk.hcmut.edu.vn/app)[Toggle navigation](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[SINH VIÊN MẪU](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'SINH VIÊN MẪU',
	'[Khoa Khoa học và Kỹ thuật Máy tính](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[Sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[Dịch vụ sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[Kết quả học tập](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[Tài liệu hướng dẫn](http://wiki.hcmut.edu.vn/)',
	'Hệ thống quản lý Quản lý người dùng',
	'[Quản lý người dùng](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'Người dùng',
	'Trở về trang trước',
	'THỜI KHÓA BIỂU HỌC KỲ',
	'Họ tên: SINH VIÊN MẪU (DEMO-STUDENT-ID)',
	'Tuần: 47 , Thứ Ba, Ngày 17/11/2026',
	'Ghi chú: Các môn học có trong Thời khóa biểu là kết quả đăng ký môn học chính thức.Sinh viên chỉ được thực hiện Đồ án, Thực tập, Luận văn tốt nghiệp, ... và được ghi điểm vào cuối học kỳ khi các môn này có trong Thời khóa biểu (có phân nhóm). Với các môn không có Thứ, Tiết, Phòng: sinh viên liên hệ Bộ môn/Khoa để được hướng dẫn.',
	PASTE_1_SELECT_LINE,
	'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
	'Ngày cập nhật gần nhất của HK này: 13/11/2026 13:41:36',
	'Trình bày 102550100 dòng/trang',
	'Tìm kiếm:'
];

const PASTE_1_SUFFIX = [
	'Trình bày từ dòng 1 đến 10 / 13 dòng',
	'[Lùi](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[1](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[2](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[Tới](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'Tổng số tín chỉ đăng ký: 16',
	'Version 2.4.0',
	'Copyright © 2026 [Academic Affairs Office](http://www.aao.hcmut.edu.vn/). All rights reserved.'
];

export const PASTE_1_NL = [
	...PASTE_1_PREFIX,
	...PASTE_1_HEADER_COLS,
	...PASTE_1_ROWS.flat(),
	...PASTE_1_SUFFIX
].join('\n');

export const PASTE_1_TSV = [
	...PASTE_1_PREFIX,
	PASTE_1_HEADER_COLS.join('\t'),
	...PASTE_1_ROWS.map((row) => row.join('\t')),
	...PASTE_1_SUFFIX
].join('\n');

const PASTE_1_PAGE2_ROWS: string[][] = [
	PASTE_1_ROWS[1], // Exact overlap: SP1033
	[
		'20261',
		'CO2007',
		'Kiến trúc Máy tính',
		'4',
		'4',
		'CC03',
		'4',
		'2 - 4',
		'7:00 - 9:50',
		'B1-202',
		'BK-CS1',
		'35|36|37|38|39|40|41|--|43|44|45|46|47|'
	],
	[
		'20261',
		'MT1003',
		'Giải tích 1',
		'4',
		'4',
		'CC01',
		'2',
		'7 - 9',
		'12:00 - 14:50',
		'H1-301',
		'BK-CS2',
		'35|36|37|38|39|40|41|--|43|44|45|46|47|'
	],
	[
		'20261',
		'PH1003',
		'Vật lý 1',
		'4',
		'4',
		'CC02',
		'6',
		'7 - 8',
		'12:00 - 13:50',
		'H6-201',
		'BK-CS2',
		'35|36|37|38|39|40|41|--|43|44|45|46|47|'
	]
];

const PASTE_1_PAGE2_SUFFIX = [
	'Trình bày từ dòng 11 đến 13 / 13 dòng',
	'[Lùi](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[1](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[2](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'[Tới](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb#)',
	'Tổng số tín chỉ đăng ký: 16',
	'Version 2.4.0',
	'Copyright © 2026 [Academic Affairs Office](http://www.aao.hcmut.edu.vn/). All rights reserved.'
];

export const PASTE_1_PAGE2_NL = [
	...PASTE_1_PREFIX,
	...PASTE_1_HEADER_COLS,
	...PASTE_1_PAGE2_ROWS.flat(),
	...PASTE_1_PAGE2_SUFFIX
].join('\n');

export const PASTE_1_PAGE2_TSV = [
	...PASTE_1_PREFIX,
	PASTE_1_HEADER_COLS.join('\t'),
	...PASTE_1_PAGE2_ROWS.map((row) => row.join('\t')),
	...PASTE_1_PAGE2_SUFFIX
].join('\n');

const PASTE_2_HEADER_COLS = [
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

const PASTE_2_ROWS: string[][] = [
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
	],
	[
		'20261',
		'CO2007 - Kiến trúc Máy tính',
		'CC03_B_Thi',
		'2026-12-30',
		'CK',
		'BK-CS1',
		'B4-406',
		'4',
		'09g30',
		'90',
		'2026-10-23 10:10:00'
	],
	[
		'20261',
		'CH1003 - Hóa đại cương',
		'CC06_A_Thi',
		'2026-12-18',
		'CK',
		'BK-CS1',
		'B4-501',
		'6',
		'09g30',
		'70',
		'2026-10-23 10:10:00'
	],
	[
		'20261',
		'CNTTNC - CNTTNC',
		'CC14_A_Thi',
		'2026-12-05',
		'CK',
		'BK-CS1',
		'C6-102',
		'7',
		'09g30',
		'90',
		'2026-10-26 14:10:00'
	],
	[
		'20261',
		'CO2003 - Cấu trúc Dữ liệu và Giải Thuật',
		'CC01_A_Thi',
		'2026-12-25',
		'CK',
		'BK-CS1',
		'B4-504',
		'6',
		'15g30',
		'90',
		'2026-10-23 10:10:00'
	],
	[
		'20261',
		'CO2003 - Cấu trúc Dữ liệu và Giải Thuật',
		'CC01_A_Ktr',
		'2026-10-15',
		'GK',
		'BK-CS1',
		'B4-405',
		'5',
		'07g00',
		'60',
		'2026-09-21 14:09:00'
	],
	[
		'20261',
		'CO2007 - Kiến trúc Máy tính',
		'CC03_B_Ktr',
		'2026-10-12',
		'GK',
		'BK-CS1',
		'B6-306',
		'2',
		'09g00',
		'60',
		'2026-09-21 14:09:00'
	],
	[
		'20261',
		'CO2011 - Mô hình hóa Toán học',
		'CC02_C_Ktr',
		'2026-10-16',
		'GK',
		'BK-CS1',
		'C4-403',
		'6',
		'13g00',
		'70',
		'2026-09-21 14:09:00'
	]
];

const PASTE_2_PREFIX = [
	'[myBk/app](https://mybk.hcmut.edu.vn/app)[Toggle navigation](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[SINH VIÊN MẪU](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'SINH VIÊN MẪU',
	'[Khoa Khoa học và Kỹ thuật Máy tính](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[Sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[Dịch vụ sinh viên](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[Kết quả học tập](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[Tài liệu hướng dẫn](http://wiki.hcmut.edu.vn/)',
	'Hệ thống quản lý Quản lý người dùng',
	'[Quản lý người dùng](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'Người dùng',
	'Trở về trang trước',
	'LỊCH KIỂM TRA - THI HỌC KỲ',
	'Họ tên: SINH VIÊN MẪU (DEMO-STUDENT-ID)',
	PASTE_2_SELECT_LINE,
	'20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)',
	'Trình bày 102550100 dòng/trang',
	'Tìm kiếm:'
];

const PASTE_2_SUFFIX = [
	'Trình bày từ dòng 1 đến 9 / 9 dòng',
	'[Lùi](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[1](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'[Tới](https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/lich-thi#)',
	'Version 2.4.0',
	'Copyright © 2026 [Academic Affairs Office](http://www.aao.hcmut.edu.vn/). All rights reserved.'
];

export const PASTE_2_NL = [
	...PASTE_2_PREFIX,
	...PASTE_2_HEADER_COLS,
	...PASTE_2_ROWS.flat(),
	...PASTE_2_SUFFIX
].join('\n');

export const PASTE_2_TSV = [
	...PASTE_2_PREFIX,
	PASTE_2_HEADER_COLS.join('\t'),
	...PASTE_2_ROWS.map((row) => row.join('\t')),
	...PASTE_2_SUFFIX
].join('\n');

export const PASTE_1_EXPECTED_ROWS = [
	{
		code: 'SP1033',
		nameSub: 'Kinh tế Chính trị Mác - Lênin',
		weekday: 2,
		startHm: [9, 0] as [number, number],
		endHm: [10, 50] as [number, number],
		room: 'C5-HOITRUONG',
		weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47]
	},
	{
		code: 'CO2003',
		nameSub: 'Cấu trúc Dữ liệu và Giải Thuật',
		weekday: 3,
		startHm: [13, 0] as [number, number],
		endHm: [14, 50] as [number, number],
		room: 'B1-306',
		weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47, null, 49, 50]
	},
	{
		code: 'SK2001',
		nameSub: 'Kỹ năng Tư duy khoa học',
		weekday: 3,
		startHm: [15, 0] as [number, number],
		endHm: [17, 50] as [number, number],
		room: 'C5-302',
		weeks: [null, null, null, null, null, null, null, null, null, null, null, 46, 47, null, 49, 50]
	},
	{
		code: 'CH1003',
		nameSub: 'Hóa đại cương',
		weekday: 3,
		startHm: [9, 0] as [number, number],
		endHm: [10, 50] as [number, number],
		room: 'C5-303',
		weeks: [35, null, 37, 38, 39, 40, 41, null, 43, 44, 45, 46, 47, null, 49, 50]
	},
	{
		code: 'CO2008',
		nameSub: 'Kiến trúc Máy tính (Th)',
		weekday: 4,
		startHm: [13, 0] as [number, number],
		endHm: [17, 50] as [number, number],
		room: 'C5-202',
		weeks: [null, null, null, null, null, null, 41, null, 43, null, 45, null, 47]
	},
	{
		code: 'CH1004',
		nameSub: 'Hóa đại cương (TN)',
		weekday: 5,
		startHm: [7, 0] as [number, number],
		endHm: [11, 50] as [number, number],
		room: 'B2-406',
		weeks: [null, null, null, 38, 39, 40, 41]
	},
	{
		code: 'CO2004',
		nameSub: 'Cấu trúc Dữ liệu và Giải Thuật (Th)',
		weekday: 5,
		startHm: [13, 0] as [number, number],
		endHm: [17, 50] as [number, number],
		room: 'C6-102',
		weeks: [null, null, null, 38, null, 40, null, null, null, 44, null, 46, null, 48, null, 50]
	},
	{
		code: 'CO2011',
		nameSub: 'Mô hình hóa Toán học',
		weekday: 6,
		startHm: [9, 0] as [number, number],
		endHm: [10, 50] as [number, number],
		room: 'C5-502',
		weeks: [35, 36, 37, 38, null, null, null, null, 43, 44, 45]
	},
	{
		code: 'CO2011',
		nameSub: 'Mô hình hóa Toán học',
		weekday: 6,
		startHm: [9, 0] as [number, number],
		endHm: [10, 50] as [number, number],
		room: 'C5-502',
		weeks: [null, null, null, null, 39, 40, 41, null, null, null, null, 46, 47, 48, 49, 50]
	}
];

export const PASTE_2_EXPECTED_EXAMS: ExamRow[] = [
	{
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
	},
	{
		semester: 261,
		courseCode: 'SP1033',
		courseName: 'Kinh tế Chính trị Mác - Lênin',
		rawCourse: 'SP1033 - Kinh tế Chính trị Mác - Lênin',
		group: 'CC02_D_Thi',
		date: '2026-12-31',
		examType: 'CK',
		campus: 'BK-CS1',
		room: 'B4-502',
		weekday: 5,
		startHm: [9, 30],
		endHm: [10, 20],
		durationMinutes: 50,
		updatedAt: '2026-10-23 10:10:00'
	},
	{
		semester: 261,
		courseCode: 'CO2007',
		courseName: 'Kiến trúc Máy tính',
		rawCourse: 'CO2007 - Kiến trúc Máy tính',
		group: 'CC03_B_Thi',
		date: '2026-12-30',
		examType: 'CK',
		campus: 'BK-CS1',
		room: 'B4-406',
		weekday: 4,
		startHm: [9, 30],
		endHm: [11, 0],
		durationMinutes: 90,
		updatedAt: '2026-10-23 10:10:00'
	},
	{
		semester: 261,
		courseCode: 'CH1003',
		courseName: 'Hóa đại cương',
		rawCourse: 'CH1003 - Hóa đại cương',
		group: 'CC06_A_Thi',
		date: '2026-12-18',
		examType: 'CK',
		campus: 'BK-CS1',
		room: 'B4-501',
		weekday: 6,
		startHm: [9, 30],
		endHm: [10, 40],
		durationMinutes: 70,
		updatedAt: '2026-10-23 10:10:00'
	},
	{
		semester: 261,
		courseCode: 'CNTTNC',
		courseName: 'CNTTNC',
		rawCourse: 'CNTTNC - CNTTNC',
		group: 'CC14_A_Thi',
		date: '2026-12-05',
		examType: 'CK',
		campus: 'BK-CS1',
		room: 'C6-102',
		weekday: 7,
		startHm: [9, 30],
		endHm: [11, 0],
		durationMinutes: 90,
		updatedAt: '2026-10-26 14:10:00'
	},
	{
		semester: 261,
		courseCode: 'CO2003',
		courseName: 'Cấu trúc Dữ liệu và Giải Thuật',
		rawCourse: 'CO2003 - Cấu trúc Dữ liệu và Giải Thuật',
		group: 'CC01_A_Thi',
		date: '2026-12-25',
		examType: 'CK',
		campus: 'BK-CS1',
		room: 'B4-504',
		weekday: 6,
		startHm: [15, 30],
		endHm: [17, 0],
		durationMinutes: 90,
		updatedAt: '2026-10-23 10:10:00'
	},
	{
		semester: 261,
		courseCode: 'CO2003',
		courseName: 'Cấu trúc Dữ liệu và Giải Thuật',
		rawCourse: 'CO2003 - Cấu trúc Dữ liệu và Giải Thuật',
		group: 'CC01_A_Ktr',
		date: '2026-10-15',
		examType: 'GK',
		campus: 'BK-CS1',
		room: 'B4-405',
		weekday: 5,
		startHm: [7, 0],
		endHm: [8, 0],
		durationMinutes: 60,
		updatedAt: '2026-09-21 14:09:00'
	},
	{
		semester: 261,
		courseCode: 'CO2007',
		courseName: 'Kiến trúc Máy tính',
		rawCourse: 'CO2007 - Kiến trúc Máy tính',
		group: 'CC03_B_Ktr',
		date: '2026-10-12',
		examType: 'GK',
		campus: 'BK-CS1',
		room: 'B6-306',
		weekday: 2,
		startHm: [9, 0],
		endHm: [10, 0],
		durationMinutes: 60,
		updatedAt: '2026-09-21 14:09:00'
	},
	{
		semester: 261,
		courseCode: 'CO2011',
		courseName: 'Mô hình hóa Toán học',
		rawCourse: 'CO2011 - Mô hình hóa Toán học',
		group: 'CC02_C_Ktr',
		date: '2026-10-16',
		examType: 'GK',
		campus: 'BK-CS1',
		room: 'C4-403',
		weekday: 6,
		startHm: [13, 0],
		endHm: [14, 10],
		durationMinutes: 70,
		updatedAt: '2026-09-21 14:09:00'
	}
];

export function makeSyntheticTkb2024(
	semesterLine: string,
	rows: string[][],
	options?: { tsv?: boolean; extraLinesBeforeHeader?: string[]; footer?: string }
): string {
	const delim = options?.tsv ? '\t' : '\n';
	const header = PASTE_1_HEADER_COLS.join(delim);
	const body = options?.tsv ? rows.map((r) => r.join('\t')).join('\n') : rows.flat().join('\n');
	return [
		'THỜI KHÓA BIỂU HỌC KỲ',
		semesterLine,
		...(options?.extraLinesBeforeHeader ?? []),
		header,
		body,
		options?.footer ?? ''
	]
		.filter((line) => line.length > 0)
		.join('\n');
}

export function makeSyntheticExam2024(
	semesterLine: string,
	rows: string[][],
	options?: { tsv?: boolean; extraLinesBeforeHeader?: string[]; footer?: string }
): string {
	const delim = options?.tsv ? '\t' : '\n';
	const header = PASTE_2_HEADER_COLS.join(delim);
	const body = options?.tsv ? rows.map((r) => r.join('\t')).join('\n') : rows.flat().join('\n');
	return [
		'LỊCH KIỂM TRA - THI HỌC KỲ',
		semesterLine,
		...(options?.extraLinesBeforeHeader ?? []),
		header,
		body,
		options?.footer ?? ''
	]
		.filter((line) => line.length > 0)
		.join('\n');
}
