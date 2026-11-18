import { NumOfColumnMismatchError, ParseError } from './errors';

export function parseTime(src: string): [number, number] {
	const s = src.trim();
	if (s === '-') {
		return [0, 0];
	}
	const nums = s.split(':');
	if (nums.length !== 2) {
		throw new ParseError(src, 'Time component is not separated by ":"');
	}
	const h = Number(nums[0]);
	const m = Number(nums[1]);
	if (
		nums[0].trim() === '' ||
		nums[1].trim() === '' ||
		!Number.isFinite(h) ||
		!Number.isFinite(m)
	) {
		throw new ParseError(src, 'Time component contains non-numeric values');
	}
	return [h, m];
}

export function hmFrom(tiết: number): { startHm: [number, number]; endHm: [number, number] } {
	if (tiết === 0) {
		return {
			startHm: [0, 0],
			endHm: [0, 0]
		};
	}
	if (tiết >= 1 && tiết <= 13) {
		return {
			startHm: [tiết + 5, 0],
			endHm: [tiết + 5, 50]
		};
	}
	if (tiết === 14) {
		return {
			startHm: [18, 50],
			endHm: [19, 40]
		};
	}
	if (tiết === 15) {
		return {
			startHm: [19, 40],
			endHm: [20, 30]
		};
	}
	if (tiết === 16) {
		return {
			startHm: [20, 30],
			endHm: [21, 20]
		};
	}
	if (tiết === 17) {
		return {
			startHm: [21, 20],
			endHm: [22, 10]
		};
	}
	throw new ParseError(`${tiết}`, 'Tiết must be less than 18');
}

export function parseExamTime(src: string): [number, number] {
	const match = src.trim().match(/^(\d{1,2})[gG:](\d{2})$/);
	if (!match) {
		throw new ParseError(src, 'Time component is not in "HHgMM" or "HH:MM" format');
	}
	const h = Number(match[1]);
	const m = Number(match[2]);
	if (h < 0 || h > 23 || m < 0 || m > 59) {
		throw new ParseError(src, `Exam time out of range: ${src}`);
	}
	return [h, m];
}

export function addMinutesToHm(hm: [number, number], minutes: number): [number, number] {
	if (!Number.isFinite(minutes)) {
		throw new ParseError(String(minutes), 'Invalid duration minutes');
	}
	const total = hm[0] * 60 + hm[1] + Math.trunc(minutes);
	const wrapped = ((total % 1440) + 1440) % 1440;
	return [Math.floor(wrapped / 60), wrapped % 60];
}

export type ExtractedTable = {
	headerIndex: number;
	mode: 'tab' | 'newline';
	rows: string[][];
};

export const DEFAULT_TABLE_STOP_PREFIXES = [
	'Trình bày từ dòng',
	'Tổng số tín chỉ',
	'[Lùi]',
	'Lùi',
	'Version ',
	'Copyright'
];

function cleanCell(s: string): string {
	return s
		.replace(/\r$/, '')
		.replace(/\u00a0/g, ' ')
		.trim();
}

function normalizeHeaderCell(s: string): string {
	return cleanCell(s).normalize('NFD').toLowerCase();
}

export function extractTableRows(
	lines: string[],
	headerCols: string[],
	stopPrefixes: string[] = DEFAULT_TABLE_STOP_PREFIXES
): ExtractedTable | null {
	const colCount = headerCols.length;
	if (colCount === 0) {
		return null;
	}

	const normalizedHeader = headerCols.map(normalizeHeaderCell);
	const normalizedStopPrefixes = stopPrefixes.map((p) => cleanCell(p).normalize('NFC'));

	const isStopLine = (cleaned: string): boolean => {
		const nfc = cleaned.normalize('NFC');
		return normalizedStopPrefixes.some((p) => nfc.startsWith(p));
	};

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i].replace(/\r$/, '');

		if (rawLine.includes('\t')) {
			const headerCandidate = rawLine.split('\t').map(normalizeHeaderCell);
			if (
				headerCandidate.length === colCount &&
				headerCandidate.every((cell, idx) => cell === normalizedHeader[idx])
			) {
				const rows: string[][] = [];
				for (let r = i + 1; r < lines.length; r++) {
					const rowRaw = lines[r].replace(/\r$/, '');
					const rowCleaned = cleanCell(rowRaw);
					if (rowCleaned === '') {
						continue;
					}
					if (isStopLine(rowCleaned)) {
						break;
					}
					const cols = rowRaw.split('\t').map(cleanCell);
					if (cols.length !== colCount) {
						throw new NumOfColumnMismatchError(rowRaw, colCount, cols.length);
					}
					rows.push(cols);
				}
				return { headerIndex: i, mode: 'tab', rows };
			}
		}

		if (i + colCount <= lines.length) {
			let matchesNewline = true;
			for (let idx = 0; idx < colCount; idx++) {
				if (normalizeHeaderCell(lines[i + idx]) !== normalizedHeader[idx]) {
					matchesNewline = false;
					break;
				}
			}
			if (matchesNewline) {
				const rows: string[][] = [];
				let cursor = i + colCount;
				while (cursor < lines.length) {
					while (cursor < lines.length && cleanCell(lines[cursor]) === '') {
						cursor++;
					}
					if (cursor >= lines.length) {
						break;
					}
					const firstCleaned = cleanCell(lines[cursor]);
					if (isStopLine(firstCleaned)) {
						break;
					}
					if (cursor + colCount > lines.length) {
						throw new NumOfColumnMismatchError(
							lines.slice(cursor).join('\n'),
							colCount,
							lines.length - cursor
						);
					}
					rows.push(lines.slice(cursor, cursor + colCount).map(cleanCell));
					cursor += colCount;
				}
				return { headerIndex: i, mode: 'newline', rows };
			}
		}
	}

	return null;
}
