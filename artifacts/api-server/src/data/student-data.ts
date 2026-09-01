export type StudentRecord = {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: number;
  attendance: number;
  assignmentScore: number;
  quizScore: number;
  examScore: number;
  learningActivity: number;
  submissionConsistency: number;
  behavior: Array<{
    week: string;
    attendance: number;
    assignment: number;
    quiz: number;
    learning: number;
  }>;
};

const names = [
  "Aarav Mehta", "Diya Sharma", "Kabir Rao", "Ananya Iyer", "Ishaan Nair",
  "Meera Das", "Rohan Kapoor", "Sana Khan", "Vikram Joshi", "Tara Menon",
  "Arjun Pillai", "Nisha Gupta", "Kiran Bhat", "Aditi Sen", "Neel Verma",
  "Pooja Roy", "Dev Malhotra", "Ira Thomas",
];

const metrics = [
  [94, 92, 89, 93, 91, 96], [88, 85, 84, 86, 87, 90], [82, 79, 81, 78, 80, 84],
  [77, 74, 72, 75, 73, 78], [71, 68, 70, 69, 66, 74], [68, 62, 64, 67, 61, 65],
  [63, 61, 58, 60, 57, 62], [58, 56, 51, 54, 49, 53], [52, 48, 46, 50, 43, 47],
  [47, 44, 41, 45, 38, 42], [91, 87, 90, 88, 86, 92], [85, 83, 78, 81, 80, 84],
  [79, 75, 76, 73, 71, 76], [73, 70, 67, 69, 64, 68], [66, 64, 61, 62, 60, 59],
  [60, 58, 55, 57, 51, 55], [54, 50, 48, 52, 45, 49], [42, 39, 36, 40, 34, 37],
];

function behaviorFor(values: number[], index: number) {
  const [attendance, assignment, quiz, exam, learning] = values;
  const declining = index >= 7 && index !== 10 && index !== 11;
  const deltas = declining ? [-12, -10, -9, -11, -13] : [8, 7, 6, 7, 8];
  return Array.from({ length: 6 }, (_, week) => ({
    week: `Week ${week + 1}`,
    attendance: Math.max(20, Math.min(100, attendance - deltas[0] + Math.round((week - 5) * deltas[0] / 5))),
    assignment: Math.max(20, Math.min(100, assignment - deltas[1] + Math.round((week - 5) * deltas[1] / 5))),
    quiz: Math.max(20, Math.min(100, quiz - deltas[2] + Math.round((week - 5) * deltas[2] / 5))),
    learning: Math.max(20, Math.min(100, learning - deltas[4] + Math.round((week - 5) * deltas[4] / 5))),
  }));
}

export const students: StudentRecord[] = names.map((name, index) => {
  const [attendance, assignmentScore, quizScore, examScore, learningActivity, submissionConsistency] = metrics[index];
  return {
    studentId: `STU-${String(index + 101).padStart(3, "0")}`,
    name,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@demo.edu`,
    course: index % 3 === 0 ? "Computer Science" : index % 3 === 1 ? "Information Systems" : "Data Analytics",
    year: (index % 4) + 1,
    attendance,
    assignmentScore,
    quizScore,
    examScore,
    learningActivity,
    submissionConsistency,
    behavior: behaviorFor([attendance, assignmentScore, quizScore, examScore, learningActivity], index),
  };
});

export function getStudent(studentId: string) {
  return students.find((student) => student.studentId === studentId);
}