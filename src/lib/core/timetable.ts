export type Timerow = {
	name: string;
	weekday: number;
	/** hh:mm in +07:00 timezone */
	startHm: [number, number];
	/** hh:mm in +07:00 timezone */
	endHm: [number, number];
	weeks: (number | null)[];
	location: string;
	/** see `parseStudent` and `parseLecturer` for possible keys */
	extras: Record<string, string>;
};

export type ExamRow = {
	semester: number;
	courseCode: string;
	courseName: string;
	rawCourse: string;
	group: string;
	date: string; // YYYY-MM-DD
	examType: string; // "CK" | "GK" | string
	campus: string;
	room: string;
	weekday: number; // 2..8
	startHm: [number, number];
	endHm: [number, number];
	durationMinutes: number;
	updatedAt: string;
};

export type ParseMetadata = {
	studentName?: string;
	studentId?: string;
	pagination?: {
		shownFrom?: number;
		shown: number;
		total: number;
	};
};

export type Timetable = {
	semester: number;
	startMondayUTC?: Date;
	rows: Timerow[];
	exams?: ExamRow[];
	metadata?: ParseMetadata;
};
