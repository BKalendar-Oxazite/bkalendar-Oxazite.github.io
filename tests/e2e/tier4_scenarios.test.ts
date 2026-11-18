import { describe, expect, it } from 'vitest';
import { MixedSemesterError, resolve } from '$lib/core/resolver';
import { ParseError, TableNotFoundError } from '$lib/core/parser/errors';
import type { Timetable } from '$lib/core/timetable';
import {
	collectFilesRecursive,
	defaultCalendarName,
	loadLibModule,
	loadRouteModule,
	makeSyntheticExam2024,
	normalizeIcalVolatileFields,
	PASTE_1_NL,
	PASTE_1_PAGE2_TSV,
	PASTE_1_TSV,
	PASTE_2_NL,
	PASTE_2_TSV,
	readWorkspaceText,
	rowMatchesCourse,
	runInTimezone,
	workspaceExists,
	type ColorsExports,
	type GoogleExports,
	type ModExports,
	type PostgradExports,
	type SvelteComponentModule
} from './fixtures';

describe('Tier 4 — Real-World Application Scenarios (S4-01..S4-06)', () => {
	it('S4-01: Full student Paste #1 (\\n) + Paste #2 (\\n) semester 20261 workflow', async () => {
		const mod = await loadLibModule<ModExports>('core/mod.ts');
		const colors = await loadLibModule<ColorsExports>('colors.ts');

		expect(mod.detectKind(PASTE_1_NL)).toBe('sinh viên 2024');
		expect(mod.detectKind(PASTE_2_NL)).toBe('exam');

		const meta1 = mod.extractMeta(PASTE_1_NL);
		const meta2 = mod.extractMeta(PASTE_2_NL);
		expect(meta1).toEqual({
			studentName: 'SINH VIÊN MẪU',
			studentId: 'DEMO-STUDENT-ID',
			pagination: { shownFrom: 1, shown: 10, total: 13 }
		});
		expect(meta1.pagination!.shown < meta1.pagination!.total).toBe(true);
		expect(meta2.pagination).toEqual({ shownFrom: 1, shown: 9, total: 9 });

		const tkb = mod.parseStudent2024(PASTE_1_NL);
		const exam = mod.parseExam2024(PASTE_2_NL);
		expect(tkb.semester).toBe(261);
		expect(tkb.rows).toHaveLength(9);
		expect(exam.semester).toBe(261);
		expect(exam.rows).toEqual([]);
		expect(exam.exams).toHaveLength(9);

		const merged = mod.mergeTimetables([tkb, exam]);
		mod.resolve(merged);
		expect(merged.semester).toBe(261);
		expect(merged.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');
		expect(defaultCalendarName(merged)).toBe('SV261');

		const { classEvents, examEvents } = mod.formatGapiSplit(merged);
		expect(classEvents).toHaveLength(9);
		expect(examEvents).toHaveLength(9);

		const classColorIds = colors.courseColorIds(classEvents);
		const co2011Idx = classEvents
			.map((e, idx) =>
				e.summary.includes('CO2011') || e.summary.includes('Mô hình hóa') ? idx : -1
			)
			.filter((idx) => idx >= 0);
		expect(co2011Idx).toHaveLength(2);
		expect(classColorIds[co2011Idx[0]]).toBe(classColorIds[co2011Idx[1]]);

		for (const exEv of examEvents) {
			expect(exEv.reminders).toEqual({
				useDefault: false,
				overrides: [
					{ method: 'popup', minutes: 1440 },
					{ method: 'popup', minutes: 60 }
				]
			});
			expect(exEv.location).toMatch(/\(BK-CS1\)$/);
		}

		const combinedIcs = mod.formatIcal(merged);
		const classesIcs = mod.formatIcal(merged, { scope: 'classes' });
		const examsIcs = mod.formatIcal(merged, { scope: 'exams' });
		expect(combinedIcs.match(/BEGIN:VEVENT/g)).toHaveLength(18);
		expect(classesIcs.match(/BEGIN:VEVENT/g)).toHaveLength(9);
		expect(examsIcs.match(/BEGIN:VEVENT/g)).toHaveLength(9);
		expect(examsIcs.match(/TRIGGER:-P1D/g)).toHaveLength(9);
		expect(examsIcs.match(/TRIGGER:-PT60M/g)).toHaveLength(9);

		const sortedExams = [...(merged.exams ?? [])].sort((a, b) => a.date.localeCompare(b.date));
		expect(sortedExams[0].date).toBe('2026-10-12');
		expect(sortedExams[sortedExams.length - 1].date).toBe('2026-12-31');
		const urls = sortedExams.map((e) => mod.formatGoogleCalendarTemplateUrl(e));
		expect(urls).toHaveLength(9);
		for (const urlStr of urls) {
			const params = new URL(urlStr).searchParams;
			expect(params.get('action')).toBe('TEMPLATE');
			expect(params.get('ctz')).toBe('Asia/Ho_Chi_Minh');
		}
	});

	it('S4-02: Tab-delimited (\\t) multi-page paginated TKB + Exam workflow', async () => {
		const mod = await loadLibModule<ModExports>('core/mod.ts');

		expect(mod.detectKind(PASTE_1_TSV)).toBe('sinh viên 2024');
		expect(mod.detectKind(PASTE_1_PAGE2_TSV)).toBe('sinh viên 2024');
		expect(mod.detectKind(PASTE_2_TSV)).toBe('exam');

		const page1 = mod.parseStudent2024(PASTE_1_TSV);
		const page2 = mod.parseStudent2024(PASTE_1_PAGE2_TSV);
		const exam = mod.parseExam2024(PASTE_2_TSV);

		const merged = mod.mergeTimetables([page1, page2, exam]);
		mod.resolve(merged);

		expect(merged.startMondayUTC?.toISOString()).toBe('2026-08-24T00:00:00.000Z');
		expect(defaultCalendarName(merged)).toBe('SV261');
		expect(merged.rows).toHaveLength(12);
		expect(
			merged.rows.filter((r) => rowMatchesCourse(r, 'SP1033', 'Kinh tế Chính trị Mác - Lênin'))
		).toHaveLength(1);
		expect(
			merged.rows.filter((r) => rowMatchesCourse(r, 'CO2011', 'Mô hình hóa Toán học'))
		).toHaveLength(2);
		expect(merged.exams).toHaveLength(9);

		const ics = mod.formatIcal(merged);
		expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(21);
		const { classEvents, examEvents } = mod.formatGapiSplit(merged);
		expect(classEvents).toHaveLength(12);
		expect(examEvents).toHaveLength(9);

		const nlBaseline = mod.mergeTimetables([
			mod.parseStudent2024(PASTE_1_NL),
			mod.parseExam2024(PASTE_2_NL)
		]);
		mod.resolve(nlBaseline);
		expect(examEvents).toEqual(mod.formatGapiSplit(nlBaseline).examEvents);
	});

	it('S4-03: Exam-only student workflow (THI261, no TKB rows)', async () => {
		const mod = await loadLibModule<ModExports>('core/mod.ts');
		const colors = await loadLibModule<ColorsExports>('colors.ts');

		for (const input of [PASTE_2_NL, PASTE_2_TSV]) {
			expect(mod.detectKind(input)).toBe('exam');
			const meta = mod.extractMeta(input);
			expect(meta.studentName).toBe('SINH VIÊN MẪU');
			expect(meta.studentId).toBe('DEMO-STUDENT-ID');
			expect(meta.pagination).toEqual({ shownFrom: 1, shown: 9, total: 9 });

			const tt = mod.parseExam2024(input);
			expect(tt.semester).toBe(261);
			expect(tt.rows).toEqual([]);
			expect(tt.exams).toHaveLength(9);
			expect(() => mod.resolve(tt)).not.toThrow();
			expect(tt.startMondayUTC).toBeUndefined();
			expect(defaultCalendarName(tt)).toBe('THI261');

			const icsAll = mod.formatIcal(tt);
			const icsClasses = mod.formatIcal(tt, { scope: 'classes' });
			expect(icsAll.match(/BEGIN:VEVENT/g)).toHaveLength(9);
			expect(icsAll).not.toContain('RRULE:');
			expect(icsAll.match(/BEGIN:VALARM/g)).toHaveLength(18);
			expect(icsClasses).toContain('BEGIN:VCALENDAR');
			expect(icsClasses).not.toContain('BEGIN:VEVENT');

			const { classEvents, examEvents } = mod.formatGapiSplit(tt);
			expect(classEvents).toEqual([]);
			expect(examEvents).toHaveLength(9);
			const highlighted = examEvents.map((ev) => ({
				...ev,
				colorId: colors.EXAM_TOMATO_COLOR_ID
			}));
			expect(highlighted.every((ev) => ev.colorId === '11')).toBe(true);

			const sorted = [...examEvents].sort((a, b) =>
				a.start.dateTime.localeCompare(b.start.dateTime)
			);
			expect(sorted[0].summary).toContain('CO2007');
			expect(sorted[0].start.dateTime.startsWith('2026-10-12')).toBe(true);
			expect(sorted[1].summary).toContain('CO2003');
			expect(sorted[1].start.dateTime.startsWith('2026-10-15')).toBe(true);
			expect(sorted[2].summary).toContain('CO2011');
			expect(sorted[2].start.dateTime.startsWith('2026-10-16')).toBe(true);
			expect(sorted[sorted.length - 1].summary).toContain('SP1033');
			expect(sorted[sorted.length - 1].start.dateTime.startsWith('2026-12-31')).toBe(true);
		}
	});

	it('S4-04: Cross-timezone user invariance (TZ=America/New_York vs TZ=Asia/Ho_Chi_Minh)', () => {
		const execFullPipeline = (tz: string) =>
			runInTimezone<{
				resolvedTz: string;
				semester: number;
				startMondayIso: string;
				ics: string;
				split: unknown;
				templateUrls: string[];
			}>(
				tz,
				`
				const mod = await server.ssrLoadModule('$lib/core/mod');
				const merged = mod.mergeTimetables([
					mod.parseStudent2024(${JSON.stringify(PASTE_1_NL)}),
					mod.parseExam2024(${JSON.stringify(PASTE_2_NL)})
				]);
				mod.resolve(merged);
				return {
					resolvedTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
					semester: merged.semester,
					startMondayIso: merged.startMondayUTC?.toISOString(),
					ics: mod.formatIcal(merged),
					split: mod.formatGapiSplit(merged),
					templateUrls: (merged.exams ?? []).map((e) => mod.formatGoogleCalendarTemplateUrl(e))
				};
				`
			);

		const ny = execFullPipeline('America/New_York');
		const hcm = execFullPipeline('Asia/Ho_Chi_Minh');

		expect(ny.resolvedTz).toBe('America/New_York');
		expect(hcm.resolvedTz).toMatch(/Asia\/(Ho_Chi_Minh|Saigon)/);
		expect(ny.semester).toBe(261);
		expect(ny.startMondayIso).toBe('2026-08-24T00:00:00.000Z');
		expect(ny.startMondayIso).toBe(hcm.startMondayIso);
		expect(normalizeIcalVolatileFields(ny.ics)).toBe(normalizeIcalVolatileFields(hcm.ics));
		expect(ny.split).toEqual(hcm.split);
		expect(ny.templateUrls).toEqual(hcm.templateUrls);
	});

	it('S4-05: Static site, OAuth (google.ts), /privacy, Oxazite attribution & zero-secret audit', async () => {
		const googleMod = await loadLibModule<GoogleExports>('google.ts');
		expect(googleMod.DEFAULT_CLIENT_ID).toBe(
			'864474557161-jci8mppafkd21prbsg5n3ll4m23i8vda.apps.googleusercontent.com'
		);
		const googleSrc = readWorkspaceText('src/lib/google.ts');
		expect(googleSrc).toContain('PUBLIC_GOOGLE_CLIENT_ID');
		expect(googleSrc).toMatch(/hosted_domain:\s*['"]hcmut\.edu\.vn['"]/);
		expect(googleSrc).toContain('gapi.load');
		expect(googleSrc).toContain('setToken');

		const svelteCfg = readWorkspaceText('svelte.config.js');
		expect(svelteCfg).toContain('@sveltejs/adapter-static');
		expect(svelteCfg).toMatch(/base:\s*['"]['"]/);

		const layout = await loadRouteModule<{ prerender?: boolean }>('+layout.ts');
		expect(layout.prerender).toBe(true);

		const shell = await loadRouteModule<SvelteComponentModule>('+layout.svelte');
		expect(shell.default.render().html).toContain('Oxazite');

		const privacyPage = await loadRouteModule<SvelteComponentModule>('privacy/+page.svelte');
		expect(privacyPage.default.render().html).toMatch(/Google Calendar|trình duyệt|client/i);

		const srcFiles = collectFilesRecursive('src');
		expect(srcFiles.length).toBeGreaterThan(0);
		for (const file of srcFiles) {
			const content = readWorkspaceText(file);
			expect(content).not.toMatch(/GOCSPX-|client_secret/i);
		}

		const requireBuild = process.env.REQUIRE_BUILD === '1';
		const buildExists = workspaceExists('build/index.html');
		if (buildExists || requireBuild) {
			expect(workspaceExists('build/index.html')).toBe(true);
			const hasPrivacy =
				workspaceExists('build/privacy.html') || workspaceExists('build/privacy/index.html');
			expect(hasPrivacy).toBe(true);
			const builtHtml = readWorkspaceText('build/index.html');
			expect(builtHtml).not.toContain('/bkalendar.github.io/');
			for (const bFile of collectFilesRecursive('build', ['.html', '.js'])) {
				const content = readWorkspaceText(bFile);
				expect(content).not.toMatch(/GOCSPX-|client_secret/i);
			}
		}
	});

	it('S4-06: Mixed-semester guard, recovery & legacy format error/export safety', async () => {
		const mod = await loadLibModule<ModExports>('core/mod.ts');
		const postgradDirect = await loadLibModule<PostgradExports>('core/parser/postgrad.ts');

		const tkb261 = mod.parseStudent2024(PASTE_1_NL);
		const tkb261Snapshot = JSON.stringify(tkb261);
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
		expect(JSON.stringify(tkb261)).toBe(tkb261Snapshot);

		// Recovery with matching 261 exam schedule
		const exam261 = mod.parseExam2024(PASTE_2_NL);
		const recovered = mod.mergeTimetables([tkb261, exam261]);
		mod.resolve(recovered);
		expect(recovered.rows).toHaveLength(9);
		expect(recovered.exams).toHaveLength(9);
		expect(mod.formatIcal(recovered).match(/BEGIN:VEVENT/g)).toHaveLength(18);
		expect(mod.formatGapiSplit(recovered).examEvents).toHaveLength(9);

		// Legacy parsers: standalone loadability + typed error guards + Timetable export contract
		expect(postgradDirect.parsePostgrad).toBe(mod.parsePostgrad);
		for (const fn of [mod.parseStudent, mod.parseLecturer, mod.parsePostgrad]) {
			expect(() => fn('no semester')).toThrow(ParseError);
			expect(() => fn('20241 - Học kỳ 1 Năm học 2024 - 2025\nno table')).toThrow(
				TableNotFoundError
			);
		}
		const legacySample: Timetable = {
			semester: 241,
			rows: [
				{
					name: 'CO5001 - Advanced Topics',
					weekday: 3,
					startHm: [18, 0],
					endHm: [20, 30],
					weeks: [35, 36, 37, 38],
					location: 'B4-201',
					extras: {}
				}
			]
		};
		resolve(legacySample);
		expect(legacySample.startMondayUTC?.getUTCDay()).toBe(1);
		expect(mod.formatIcal(legacySample)).toContain('RRULE:');
		expect(mod.formatGapi(legacySample)).toHaveLength(1);
		expect(() =>
			resolve({
				semester: 241,
				rows: [legacySample.rows[0], { ...legacySample.rows[0], weeks: [null, 40] }]
			})
		).toThrow(MixedSemesterError);
	});
});
