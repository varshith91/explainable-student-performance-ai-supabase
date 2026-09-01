import type { StudentRecord } from "../data/student-data";
import { isSupabaseConfigured, supabaseJson } from "./supabase";
import { logger } from "./logger";

type SupabaseStudentRow = {
  student_id: string;
  name: string;
  email?: string | null;
  course?: string | null;
  year?: number | null;
};

type SupabasePerformanceRow = {
  student_id: string;
  attendance?: number | null;
  assignment_score?: number | null;
  quiz_score?: number | null;
  exam_score?: number | null;
  learning_activity?: number | null;
  submission_consistency?: number | null;
  date?: string | null;
};

type SupabaseBehaviorRow = {
  student_id: string;
  week: string;
  attendance?: number | null;
  assignment?: number | null;
  quiz?: number | null;
  learning?: number | null;
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function latestPerformanceByStudent(rows: SupabasePerformanceRow[]) {
  const map = new Map<string, SupabasePerformanceRow>();
  for (const row of rows) {
    const existing = map.get(row.student_id);
    if (!existing || String(row.date ?? "") >= String(existing.date ?? "")) {
      map.set(row.student_id, row);
    }
  }
  return map;
}

function behaviorFromPerformance(values: {
  attendance: number;
  assignmentScore: number;
  quizScore: number;
  examScore: number;
  learningActivity: number;
}) {
  const { attendance, assignmentScore, quizScore, examScore, learningActivity } = values;
  return Array.from({ length: 6 }, (_, week) => ({
    week: `Week ${week + 1}`,
    attendance: Math.max(20, Math.min(100, attendance - 8 + Math.round((week * 16) / 5))),
    assignment: Math.max(20, Math.min(100, assignmentScore - 7 + Math.round((week * 14) / 5))),
    quiz: Math.max(20, Math.min(100, quizScore - 7 + Math.round((week * 14) / 5))),
    learning: Math.max(20, Math.min(100, learningActivity - 8 + Math.round((week * 16) / 5))),
  }));
}

function toStudentRecord(
  profile: SupabaseStudentRow,
  performance: SupabasePerformanceRow | undefined,
  behaviorRows: SupabaseBehaviorRow[],
): StudentRecord {
  const attendance = asNumber(performance?.attendance, 75);
  const assignmentScore = asNumber(performance?.assignment_score, 75);
  const quizScore = asNumber(performance?.quiz_score, 75);
  const examScore = asNumber(performance?.exam_score, 75);
  const learningActivity = asNumber(performance?.learning_activity, 75);
  const submissionConsistency = asNumber(performance?.submission_consistency, 80);

  const behavior =
    behaviorRows.length > 0
      ? behaviorRows.map((row) => ({
          week: row.week,
          attendance: asNumber(row.attendance, attendance),
          assignment: asNumber(row.assignment, assignmentScore),
          quiz: asNumber(row.quiz, quizScore),
          learning: asNumber(row.learning, learningActivity),
        }))
      : behaviorFromPerformance({
          attendance,
          assignmentScore,
          quizScore,
          examScore,
          learningActivity,
        });

  return {
    studentId: profile.student_id,
    name: profile.name,
    email: profile.email ?? `${profile.student_id.toLowerCase()}@demo.edu`,
    course: profile.course ?? "Computer Science",
    year: asNumber(profile.year, 1),
    attendance,
    assignmentScore,
    quizScore,
    examScore,
    learningActivity,
    submissionConsistency,
    behavior,
  };
}

export async function loadStudentsFromSupabase(): Promise<StudentRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const [studentsResult, performanceResult, behaviorResult] = await Promise.all([
    supabaseJson("/rest/v1/students?select=student_id,name,email,course,year"),
    supabaseJson("/rest/v1/performance?select=student_id,attendance,assignment_score,quiz_score,exam_score,learning_activity,submission_consistency,date"),
    supabaseJson("/rest/v1/weekly_behavior?select=student_id,week,attendance,assignment,quiz,learning&order=week"),
  ]);

  if (!studentsResult.response.ok || !Array.isArray(studentsResult.data)) {
    logger.error(
      { status: studentsResult.response.status, data: studentsResult.data },
      "Supabase students request failed",
    );
    throw new Error("Could not load students from Supabase.");
  }

  const profiles = studentsResult.data as SupabaseStudentRow[];
  if (profiles.length === 0) {
    throw new Error(
      "Supabase students table returned 0 rows. If data exists in the dashboard, enable SELECT access for the API key (RLS policy) or set SUPABASE_SERVICE_ROLE_KEY in artifacts/api-server/.env.",
    );
  }
  const performanceRows = performanceResult.response.ok && Array.isArray(performanceResult.data)
    ? (performanceResult.data as SupabasePerformanceRow[])
    : [];
  const behaviorRows = behaviorResult.response.ok && Array.isArray(behaviorResult.data)
    ? (behaviorResult.data as SupabaseBehaviorRow[])
    : [];

  const performanceByStudent = latestPerformanceByStudent(performanceRows);
  const behaviorByStudent = new Map<string, SupabaseBehaviorRow[]>();
  for (const row of behaviorRows) {
    const list = behaviorByStudent.get(row.student_id) ?? [];
    list.push(row);
    behaviorByStudent.set(row.student_id, list);
  }

  return profiles.map((profile) =>
    toStudentRecord(
      profile,
      performanceByStudent.get(profile.student_id),
      behaviorByStudent.get(profile.student_id) ?? [],
    ),
  );
}
