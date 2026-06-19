export type QuestionField = "name" | "location" | "rawIdea" | "targetUser" | "problem" | "status" | "hoursPerWeek" | "budget" | "skills" | "teamStatus" | "stage" | "evidenceLevel" | "alternatives" | "thirtyDayGoal" | "openToModification";
export type Question = {
  id: number; field: QuestionField; question: string; conversationalVariant: string;
  expectedAnswerType: "text" | "number" | "choice" | "longText"; isCritical: boolean;
  exampleGoodAnswer: string; exampleBadAnswer: string; whyItMatters: string;
};
const make = (id: number, field: QuestionField, question: string, whyItMatters: string, isCritical = false): Question => ({
  id, field, question, conversationalVariant: question, expectedAnswerType: field === "hoursPerWeek" ? "number" : "longText",
  isCritical, exampleGoodAnswer: "", exampleBadAnswer: "", whyItMatters,
});
export const CORE_QUESTIONS: Question[] = [
  make(1, "name", "What should LaunchPilot call you?", "Personalizes the founder workspace.", true),
  make(2, "location", "Where are you based? Country and city is enough.", "Adds location-specific constraints and opportunities.", true),
  make(3, "rawIdea", "What are you trying to build, or do you not have an idea yet?", "The research pipeline needs the direction early.", true),
  make(4, "targetUser", "Who do you think this is for?", "A specific first user makes evidence and positioning testable.", true),
  make(5, "problem", "What painful problem does it solve for them?", "Problem urgency is more important than feature detail.", true),
  make(6, "status", "What is your current situation — student, working, freelancing, or building full-time?", "Shapes realistic execution constraints."),
  make(7, "hoursPerWeek", "How many focused hours can you protect each week?", "Keeps the roadmap feasible."),
  make(8, "budget", "What budget can you use for testing right now?", "Keeps the MVP and research plan grounded."),
  make(9, "skills", "What useful skills or domain access do you already have?", "Identifies founder fit and skill gaps."),
  make(10, "teamStatus", "Are you building solo or with a team?", "Sets realistic delivery capacity."),
  make(11, "stage", "Which stage are you at?", "Selects problem discovery, validation, or pilot mode.", true),
  make(12, "evidenceLevel", "What proof do you currently have? 'No proof yet' is valid.", "Separates assumptions from validation.", true),
  make(13, "alternatives", "What do people use today instead of your idea?", "Reveals competition and switching cost."),
  make(14, "thirtyDayGoal", "What one measurable result would count as progress in 30 days?", "Creates a testable milestone."),
  make(15, "openToModification", "Are you open to narrowing, changing, or rejecting this version if evidence is weak?", "Prevents the process from blindly endorsing an idea.", true),
];
export const getQuestionById = (id: number) => CORE_QUESTIONS.find((question) => question.id === id);
export const getQuestionByField = (field: QuestionField) => CORE_QUESTIONS.find((question) => question.field === field);
