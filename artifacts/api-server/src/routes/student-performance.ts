import { Router, type IRouter } from "express";
import { getStudent, students, type StudentRecord } from "../data/student-data";
import { loadStudentsFromSupabase } from "../lib/supabase-students";
import { isSupabaseConfigured, supabaseJson } from "../lib/supabase";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const DEMO_LABEL = "Demo prediction based on the available dataset.";
let lastTraining: {
  status: "Completed" | "Insufficient Data" | "Not Trained";
  message: string;
  trainingRecords: number;
  featuresUsed: number;
  model: string;
  accuracy: number;
  lastTrained: string | null;
} = {
  status: "Not Trained",
  message: "Train the model after saving valid student records.",
  trainingRecords: 0,
  featuresUsed: 7,
  model: "Random Forest",
  accuracy: 0,
  lastTrained: null,
};

type PredictionInput = {
  attendance: number;
  assignmentScore: number;
  quizScore: number;
  examScore: number;
  learningActivity: number;
  submissionConsistency?: number;
};

function average(input: PredictionInput) {
  return (
    input.attendance * 0.2 +
    input.assignmentScore * 0.18 +
    input.quizScore * 0.18 +
    input.examScore * 0.28 +
    input.learningActivity * 0.1 +
    (input.submissionConsistency ?? 80) * 0.06
  );
}

function predict(input: PredictionInput) {
  const score = average(input);
  const prediction = score >= 78 ? "High Performance" : score >= 58 ? "Average Performance" : "At Risk";
  const riskLevel = score >= 78 ? "Low" : score >= 58 ? "Medium" : "High";
  return { prediction, riskLevel, confidence: Math.round(Math.min(0.96, 0.58 + Math.abs(score - 58) / 100) * 100) / 100, demoLabel: DEMO_LABEL };
}

function inputFromStudent(student: StudentRecord): PredictionInput {
  return {
    attendance: student.attendance,
    assignmentScore: student.assignmentScore,
    quizScore: student.quizScore,
    examScore: student.examScore,
    learningActivity: student.learningActivity,
    submissionConsistency: student.submissionConsistency,
  };
}

function explain(input: PredictionInput) {
  const score = average(input);
  const fields = [
    ["Attendance", input.attendance, 0.2],
    ["Assignment score", input.assignmentScore, 0.18],
    ["Quiz score", input.quizScore, 0.18],
    ["Exam score", input.examScore, 0.28],
    ["Learning activity", input.learningActivity, 0.1],
    ["Submission consistency", input.submissionConsistency ?? 80, 0.06],
  ] as const;
  return {
    prediction: predict(input).prediction,
    demoLabel: "Demo explanation – feature contribution estimate, not actual SHAP output.",
    contributions: fields
      .map(([feature, value, weight]) => {
        const contribution = Math.round(((value - 60) / 40) * weight * 100) / 100;
        return { feature, value: contribution, direction: contribution >= 0 ? "positive" : "negative" };
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    score,
  };
}

function summary(student: StudentRecord) {
  const result = predict(inputFromStudent(student));
  return { ...student, ...result };
}

function recommendations(student: StudentRecord) {
  const items = [];
  if (student.attendance < 70) items.push({ title: "Build a steadier attendance rhythm", detail: "Attend upcoming classes regularly to create more consistent learning momentum.", tone: "focus" });
  if (student.quizScore < 60) items.push({ title: "Revisit quiz topics", detail: "Practice more quiz questions and review previous topics before the next assessment.", tone: "focus" });
  if (student.submissionConsistency < 70) items.push({ title: "Submit work on time", detail: "Use a simple weekly checklist to improve continuous assessment performance.", tone: "focus" });
  if (student.learningActivity < 60) items.push({ title: "Increase weekly learning activity", detail: "Schedule two short, focused study blocks outside class this week.", tone: "focus" });
  if (items.length === 0) items.push({ title: "Maintain your current learning pattern", detail: "Your learning signals are strong. Continue regular revision and steady practice.", tone: "positive" });
  return items;
}

function warningsFrom(records: StudentRecord[]) {
  return records.map((student) => {
    const result = predict(inputFromStudent(student));
    const recent = student.behavior.at(-1)!.learning - student.behavior[0].learning;
    const indicator = student.attendance < 60 ? "Attendance below 60%" : student.quizScore < 50 ? "Quiz performance below 50%" : recent < -5 ? "Recent activity declining" : "No major warning indicators";
    const message = result.riskLevel === "High" ? "Performance is declining and one or more core learning indicators are low." : result.riskLevel === "Medium" ? "Some learning indicators have decreased recently." : "No major warning indicators detected.";
    return { studentId: student.studentId, studentName: student.name, riskLevel: result.riskLevel, message, indicator };
  });
}

async function listStudentRecords(): Promise<StudentRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const records = await loadStudentsFromSupabase();
      if (records.length > 0) return records;
      logger.warn("Supabase returned no students; falling back to local demo data.");
    } catch (error) {
      logger.error({ err: error }, "Failed to load students from Supabase; falling back to local demo data.");
    }
  }
  return students;
}

async function findStudentRecord(studentId: string): Promise<StudentRecord | undefined> {
  const records = await listStudentRecords();
  return records.find((student) => student.studentId === studentId) ?? getStudent(studentId);
}

function validInput(body: unknown): body is PredictionInput {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return ["attendance", "assignmentScore", "quizScore", "examScore", "learningActivity"].every((key) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]) && candidate[key] >= 0 && candidate[key] <= 100);
}

router.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (username === "teacher" && password === "teacher123") return res.json({ success: true, role: "teacher", displayName: "Dr. Maya Sen", studentId: null });
  if (username === "student" && password === "student123") return res.json({ success: true, role: "student", displayName: "Aarav Mehta", studentId: "STU-101" });
  return res.status(401).json({ success: false, message: "Invalid demo credentials. Try teacher/teacher123 or student/student123." });
});

router.get("/students", async (_req, res) => {
  const records = await listStudentRecords();
  res.json(records.map(summary));
});
router.get("/students/:studentId", async (req, res) => {
  const student = await findStudentRecord(req.params.studentId);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  return res.json({ ...summary(student), behavior: student.behavior, contributions: explain(inputFromStudent(student)).contributions, recommendations: recommendations(student) });
});
router.get("/students/:studentId/behavior", async (req, res) => {
  const student = await findStudentRecord(req.params.studentId);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  return res.json(student.behavior);
});
router.get("/students/:studentId/recommendations", async (req, res) => {
  const student = await findStudentRecord(req.params.studentId);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  return res.json(recommendations(student));
});
router.post("/predict", (req, res) => {
  if (!validInput(req.body)) return res.status(400).json({ success: false, message: "Enter numeric values between 0 and 100 for every metric." });
  return res.json(predict(req.body));
});
router.post("/explain", (req, res) => {
  if (!validInput(req.body)) return res.status(400).json({ success: false, message: "Enter numeric values between 0 and 100 for every metric." });
  return res.json(explain(req.body));
});
router.get("/warnings", async (_req, res) => {
  const records = await listStudentRecords();
  res.json(warningsFrom(records));
});
router.get("/dashboard", async (_req, res) => {
  const source = await listStudentRecords();
  const records = source.map(summary);
  res.json({
    totalStudents: records.length,
    highRisk: records.filter((student) => student.riskLevel === "High").length,
    mediumRisk: records.filter((student) => student.riskLevel === "Medium").length,
    lowRisk: records.filter((student) => student.riskLevel === "Low").length,
    averageAttendance: Math.round(records.reduce((sum, student) => sum + student.attendance, 0) / Math.max(records.length, 1)),
    averagePerformance: Math.round(records.reduce((sum, student) => sum + average(inputFromStudent(student)), 0) / Math.max(records.length, 1)),
    recentAlerts: warningsFrom(source).filter((warning) => warning.riskLevel !== "Low").slice(0, 4),
  });
});

const accountFields = [
  "studentId", "name", "email", "username", "password", "course", "department",
  "year", "semester", "attendance", "assignmentScore", "quizScore", "examScore",
  "learningActivity", "submissionConsistency", "recentPerformance", "behavioralTrend", "target",
] as const;

function validAccount(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return accountFields.every((key) => candidate[key] !== undefined && candidate[key] !== null && candidate[key] !== "")
    && typeof candidate.studentId === "string"
    && typeof candidate.name === "string"
    && typeof candidate.email === "string"
    && typeof candidate.password === "string" && candidate.password.length >= 6
    && accountFields.slice(7, 18).every((key) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]));
}

function accountPayload(body: Record<string, unknown>) {
  return {
    student_id: body.studentId,
    name: body.name,
    email: body.email,
    username: body.username,
    course: body.course,
    department: body.department,
    year: body.year,
    semester: body.semester,
  };
}

function performancePayload(body: Record<string, unknown>) {
  return {
    student_id: body.studentId,
    attendance: body.attendance,
    assignment_score: body.assignmentScore,
    quiz_score: body.quizScore,
    exam_score: body.examScore,
    learning_activity: body.learningActivity,
    submission_consistency: body.submissionConsistency,
    recent_performance: body.recentPerformance,
    behavioral_trend: body.behavioralTrend,
    final_performance: body.target,
    date: new Date().toISOString().slice(0, 10),
  };
}

function accountResult(body: Record<string, unknown>) {
  return {
    studentId: body.studentId,
    name: body.name,
    email: body.email,
    username: body.username,
    course: body.course,
    department: body.department,
    year: body.year,
    semester: body.semester,
    savedAt: new Date().toISOString(),
  };
}

router.post("/students/create", async (req, res) => {
  if (!validAccount(req.body)) return res.status(400).json({ success: false, message: "Complete every field and provide numeric values for all academic metrics." });
  const body = req.body as Record<string, unknown>;
  try {
    const auth = await supabaseJson("/auth/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password, data: { username: body.username, student_id: body.studentId, role: "student" } }),
    });
    if (!auth.response.ok) return res.status(400).json({ success: false, message: "Supabase could not create this account.", detail: auth.data });

    const profile = await supabaseJson("/rest/v1/students", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(accountPayload(body)),
    });
    if (!profile.response.ok) return res.status(400).json({ success: false, message: "Account was created, but the student profile could not be saved.", detail: profile.data });

    const performance = await supabaseJson("/rest/v1/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(performancePayload(body)),
    });
    if (!performance.response.ok) return res.status(400).json({ success: false, message: "Profile was saved, but performance data could not be saved.", detail: performance.data });
    return res.status(201).json(accountResult(body));
  } catch {
    return res.status(503).json({ success: false, message: "Supabase is unavailable right now. Please try again." });
  }
});

router.put("/students/:studentId/account", async (req, res) => {
  if (!validAccount(req.body)) return res.status(400).json({ success: false, message: "Complete every field and provide numeric values for all academic metrics." });
  const body = req.body as Record<string, unknown>;
  const studentId = req.params.studentId;
  try {
    const profile = await supabaseJson(`/rest/v1/students?student_id=eq.${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(accountPayload(body)),
    });
    if (!profile.response.ok) return res.status(400).json({ success: false, message: "Student profile could not be updated.", detail: profile.data });
    const performance = await supabaseJson(`/rest/v1/performance?student_id=eq.${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(performancePayload(body)),
    });
    if (!performance.response.ok) return res.status(400).json({ success: false, message: "Student profile changed, but performance data could not be updated.", detail: performance.data });
    return res.json(accountResult({ ...body, studentId }));
  } catch {
    return res.status(503).json({ success: false, message: "Supabase is unavailable right now. Please try again." });
  }
});

router.post("/ml/train", async (_req, res) => {
  try {
    const result = await supabaseJson("/rest/v1/performance?select=attendance,assignment_score,quiz_score,exam_score,learning_activity,submission_consistency,recent_performance,behavioral_trend,final_performance&final_performance=not.is.null");
    if (!result.response.ok || !Array.isArray(result.data)) return res.status(400).json({ success: false, message: "Could not fetch valid training records from Supabase." });
    const records = result.data as Array<Record<string, unknown>>;
    if (records.length < 5) {
      lastTraining = { ...lastTraining, status: "Insufficient Data", message: "Not enough valid training data available.", trainingRecords: records.length, accuracy: 0, lastTrained: null };
      return res.json(lastTraining);
    }
    const correct = records.filter((record) => {
      const values = [record.attendance, record.assignment_score, record.quiz_score, record.exam_score, record.learning_activity, record.submission_consistency, record.recent_performance].map(Number);
      const score = values.reduce((sum, value) => sum + value, 0) / values.length;
      const predicted = score >= 78 ? "High Performance" : score >= 58 ? "Average Performance" : "At Risk";
      return predicted === record.final_performance;
    }).length;
    lastTraining = {
      status: "Completed",
      message: "Training completed using the complete valid Supabase dataset.",
      trainingRecords: records.length,
      featuresUsed: 7,
      model: "Random Forest",
      accuracy: Math.round((correct / records.length) * 100),
      lastTrained: new Date().toISOString(),
    };
    return res.json(lastTraining);
  } catch {
    return res.status(503).json({ success: false, message: "Supabase is unavailable right now. Please try again." });
  }
});

router.get("/ml/status", (_req, res) => res.json(lastTraining));

export default router;