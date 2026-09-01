import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Database, LockKeyhole, Save, Sparkles, UserPlus } from "lucide-react";
import {
  useCreateStudentAccount,
  getGetStudentQueryKey,
  useGetMlStatus,
  useGetStudent,
  useGetStudents,
  useTrainMlModel,
  useUpdateStudentAccount,
} from "@workspace/api-client-react";
import type { StudentAccountInput } from "@workspace/api-client-react";

const blankForm: StudentAccountInput = {
  studentId: "",
  name: "",
  email: "",
  username: "",
  password: "",
  course: "Computer Science",
  department: "School of Computing",
  year: 1,
  semester: 1,
  attendance: 75,
  assignmentScore: 75,
  quizScore: 75,
  examScore: 75,
  learningActivity: 75,
  submissionConsistency: 75,
  recentPerformance: 75,
  behavioralTrend: 0,
  target: "Average Performance",
};

const metricFields: Array<{ key: keyof StudentAccountInput; label: string; min?: number; max?: number }> = [
  { key: "attendance", label: "Attendance %" },
  { key: "assignmentScore", label: "Assignment score" },
  { key: "quizScore", label: "Quiz score" },
  { key: "examScore", label: "Exam score" },
  { key: "learningActivity", label: "Learning activity" },
  { key: "submissionConsistency", label: "Submission consistency" },
  { key: "recentPerformance", label: "Recent performance" },
  { key: "behavioralTrend", label: "Behavioral trend", min: -100, max: 100 },
];

function Field({ label, value, onChange, type = "text", min, max, placeholder }: { label: string; value: string | number; onChange: (value: string | number) => void; type?: string; min?: number; max?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" type={type} value={value} min={min} max={max} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} />
    </label>
  );
}

export default function StudentAccountPage() {
  const studentsQuery = useGetStudents();
  const statusQuery = useGetMlStatus();
  const createAccount = useCreateStudentAccount();
  const updateAccount = useUpdateStudentAccount();
  const trainModel = useTrainMlModel();
  const [selectedId, setSelectedId] = useState("");
  const selectedQuery = useGetStudent(selectedId, { query: { enabled: Boolean(selectedId), queryKey: getGetStudentQueryKey(selectedId) } });
  const [form, setForm] = useState<StudentAccountInput>(blankForm);
  const [notice, setNotice] = useState("");
  const [isNew, setIsNew] = useState(true);
  const training = trainModel.data ?? statusQuery.data;

  useEffect(() => {
    if (!selectedQuery.data) return;
    const student = selectedQuery.data;
    setForm((current) => ({
      ...current,
      studentId: student.studentId,
      name: student.name,
      email: student.email ?? "",
      course: student.course,
      year: student.year,
      attendance: student.attendance,
      assignmentScore: student.assignmentScore,
      quizScore: student.quizScore,
      examScore: student.examScore,
      learningActivity: student.learningActivity,
      submissionConsistency: student.submissionConsistency,
      recentPerformance: student.examScore,
      target: student.prediction as StudentAccountInput["target"],
    }));
    setIsNew(false);
    setNotice("");
  }, [selectedQuery.data]);

  const studentOptions = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const update = (key: keyof StudentAccountInput) => (value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setNotice("");
    const request = isNew
      ? (data: StudentAccountInput, options: Parameters<typeof createAccount.mutate>[1]) => createAccount.mutate({ data }, options)
      : (data: StudentAccountInput, options: Parameters<typeof updateAccount.mutate>[1]) => updateAccount.mutate({ studentId: form.studentId, data }, options);
    request(form, {
      onSuccess: () => {
        setNotice(isNew ? "Student account and Supabase records created." : "Student profile and performance data updated.");
        setIsNew(false);
        setSelectedId(form.studentId);
      },
      onError: (error) => setNotice(error instanceof Error ? error.message : "The student record could not be saved."),
    });
  };
  const train = () => {
    setNotice("");
    trainModel.mutate(undefined, {
      onSuccess: (result) => setNotice(result.message),
      onError: () => setNotice("Training could not start. Check the Supabase training tables and try again."),
    });
  };

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Teacher tools / Supabase</p>
            <h2 className="display-face mt-2 text-3xl tracking-[-.04em]">Student accounts & ML training</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create a student account, keep their learning record current, and retrain the model only from the complete valid training dataset.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground"><Database size={15} className="text-primary" /> Supabase connected</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="card-surface rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e1f1ed] text-[#176453]"><UserPlus size={17} /></div><div><h3 className="font-semibold">{isNew ? "Create new student account" : "Edit student account"}</h3><p className="text-xs text-muted-foreground">Profile details and login identity</p></div></div>
            <select className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); if (!event.target.value) { setForm(blankForm); setIsNew(true); } }} aria-label="Select student">
              <option value="">Select existing student</option>
              {studentOptions.map((student) => <option key={student.studentId} value={student.studentId}>{student.studentId} · {student.name}</option>)}
            </select>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Student ID" value={form.studentId} onChange={update("studentId")} placeholder="STU-201" />
            <Field label="Student name" value={form.name} onChange={update("name")} />
            <Field label="Email" value={form.email} onChange={update("email")} type="email" />
            <Field label="Username" value={form.username} onChange={update("username")} />
            <Field label="Password" value={form.password} onChange={update("password")} type="password" placeholder={isNew ? "Minimum 6 characters" : "Enter to update"} />
            <Field label="Course" value={form.course} onChange={update("course")} />
            <Field label="Department" value={form.department} onChange={update("department")} />
            <Field label="Year" value={form.year} onChange={update("year")} type="number" min={1} max={8} />
            <Field label="Semester" value={form.semester} onChange={update("semester")} type="number" min={1} max={12} />
          </div>
        </div>

        <div className="card-surface rounded-2xl p-5 sm:p-7">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff1d1] text-[#8d6318]"><Sparkles size={17} /></div><div><h3 className="font-semibold">Training readiness</h3><p className="text-xs text-muted-foreground">Supervised learning needs a target</p></div></div>
          <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground"><LockKeyhole size={16} className="mb-2 text-primary" /><p>New data joins training only when it includes the required performance target. A single new student is never used alone.</p></div>
          <label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Training target</span><select className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" value={form.target} onChange={(event) => update("target")(event.target.value)}><option>High Performance</option><option>Average Performance</option><option>At Risk</option></select></label>
        </div>
      </section>

      <section className="card-surface rounded-2xl p-5 sm:p-7">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e1eaf6] text-[#3b5f89]"><ClipboardCheckIcon /></div><div><h3 className="font-semibold">Academic & behavioral data</h3><p className="text-xs text-muted-foreground">Update these values whenever the student's pattern changes.</p></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metricFields.map((field) => <Field key={field.key} label={field.label} value={form[field.key] as string | number} onChange={update(field.key)} type="number" min={field.min ?? 0} max={field.max ?? 100} />)}</div>
        <div className="mt-6 flex flex-wrap items-center gap-3"><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50" onClick={submit} disabled={createAccount.isPending || updateAccount.isPending}><Save size={15} /> {isNew ? "Create account" : "Save changes"}</button>{notice && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 size={16} className="text-primary" />{notice}</p>}</div>
      </section>

      <section className="card-surface rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Model operations</p><h3 className="mt-2 text-xl font-semibold">Train / update ML model</h3><p className="mt-1 text-sm text-muted-foreground">Fetches the latest valid Supabase records and updates the Random Forest training status.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-sidebar px-4 py-2.5 text-sm font-semibold text-sidebar-foreground transition hover:brightness-110 disabled:opacity-50" onClick={train} disabled={trainModel.isPending}><Sparkles size={15} /> {trainModel.isPending ? "Training…" : "Train ML model"}</button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Status", training?.status ?? "Not Trained"], ["Training records", training?.trainingRecords ?? 0], ["Features used", training?.featuresUsed ?? 7], ["Accuracy", training?.accuracy ? `${training.accuracy}%` : "—"], ["Last trained", training?.lastTrained ? new Date(training.lastTrained).toLocaleString() : "Not yet"]].map(([label, value]) => <div key={label} className="rounded-xl bg-secondary/65 p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>)}</div>
        {training?.status === "Insufficient Data" && <p className="mt-4 rounded-xl border border-[#f3d58c] bg-[#fff7df] px-4 py-3 text-sm text-[#8d6318]">{training.message}</p>}
      </section>
    </div>
  );
}

function ClipboardCheckIcon() {
  return <ClipboardCheck size={17} />;
}