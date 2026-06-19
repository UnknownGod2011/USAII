export type QuestionField =
  | "name"
  | "location"
  | "status"
  | "hoursPerWeek"
  | "budget"
  | "skills"
  | "teamStatus"
  | "stage"
  | "rawIdea"
  | "targetUser"
  | "problem"
  | "evidenceLevel"
  | "alternatives"
  | "thirtyDayGoal"
  | "openToModification";

export type Question = {
  id: number;
  field: QuestionField;
  question: string;
  conversationalVariant: string;
  expectedAnswerType: "text" | "number" | "choice" | "longText";
  isCritical: boolean;
  exampleGoodAnswer: string;
  exampleBadAnswer: string;
  whyItMatters: string;
  quickSelect?: string[];
};

export const CORE_QUESTIONS: Question[] = [
  {
    id: 1,
    field: "name",
    question: "What is your name, and what should LaunchPilot call you?",
    conversationalVariant: "Hey, ready to build? First, what should I call you?",
    expectedAnswerType: "text",
    isCritical: true,
    exampleGoodAnswer: "Tanush",
    exampleBadAnswer: "0, idk, random",
    whyItMatters: "Makes the interview personal and keeps your founder profile consistent.",
  },
  {
    id: 2,
    field: "location",
    question: "Where are you based? Country and city if comfortable.",
    conversationalVariant: "Where are you building from? Country is enough; add your city if you are comfortable.",
    expectedAnswerType: "text",
    isCritical: true,
    exampleGoodAnswer: "Mumbai, India",
    exampleBadAnswer: "earth, nowhere, idk",
    whyItMatters: "Changes which users, programs, regulations, and opportunities are relevant.",
  },
  {
    id: 3,
    field: "status",
    question: "Are you currently a student, working professional, founder, freelancer, or something else?",
    conversationalVariant: "What is your current situation: student, working professional, founder, freelancer, or something else?",
    expectedAnswerType: "choice",
    isCritical: false,
    exampleGoodAnswer: "Student",
    exampleBadAnswer: "yes, maybe",
    whyItMatters: "Helps calibrate time, pressure, and the safest execution path.",
    quickSelect: ["Student", "Working professional", "Founder", "Freelancer", "Something else"],
  },
  {
    id: 4,
    field: "hoursPerWeek",
    question: "How many hours per week can you realistically work on this idea?",
    conversationalVariant: "Realistically, how many focused hours can you give this each week?",
    expectedAnswerType: "number",
    isCritical: false,
    exampleGoodAnswer: "10 hours per week",
    exampleBadAnswer: "a lot, yes",
    whyItMatters: "Keeps the roadmap executable instead of aspirational.",
    quickSelect: ["Less than 3", "3-7", "7-15", "15+"],
  },
  {
    id: 5,
    field: "budget",
    question: "What is your current budget for building or testing this idea?",
    conversationalVariant: "What budget can you actually use for the first test? A rough range is fine.",
    expectedAnswerType: "choice",
    isCritical: false,
    exampleGoodAnswer: "Under ₹5,000",
    exampleBadAnswer: "random characters",
    whyItMatters: "Determines whether the first version should be no-code, concierge, freelance, or custom-built.",
    quickSelect: ["₹0 / no budget", "Under ₹5,000", "₹5,000-₹25,000", "₹25,000+", "Not sure"],
  },
  {
    id: 6,
    field: "skills",
    question: "What skills do you already have?",
    conversationalVariant: "What can you already do well: coding, AI, design, marketing, sales, research, writing, domain knowledge, or community access?",
    expectedAnswerType: "longText",
    isCritical: false,
    exampleGoodAnswer: "Python, UI design, research, and access to my college community",
    exampleBadAnswer: "0, idk",
    whyItMatters: "Lets LaunchPilot design around your strengths and expose only the skill gaps that matter next.",
  },
  {
    id: 7,
    field: "teamStatus",
    question: "Are you building alone or with a team?",
    conversationalVariant: "Are you building solo, with a co-founder, or with a team?",
    expectedAnswerType: "choice",
    isCritical: false,
    exampleGoodAnswer: "Solo",
    exampleBadAnswer: "maybe",
    whyItMatters: "Changes the amount of work the first milestone can realistically include.",
    quickSelect: ["Solo", "One co-founder", "Small team", "Still deciding"],
  },
  {
    id: 8,
    field: "stage",
    question: "What stage are you at?",
    conversationalVariant: "Where are you right now: no idea, rough idea, building, MVP, users, or revenue?",
    expectedAnswerType: "choice",
    isCritical: true,
    exampleGoodAnswer: "Rough idea",
    exampleBadAnswer: "yes, idk",
    whyItMatters: "Prevents LaunchPilot from giving company-stage advice to an idea-stage founder.",
    quickSelect: ["I have no idea yet", "Rough idea", "Started building", "MVP exists", "Users exist", "Revenue exists"],
  },
  {
    id: 9,
    field: "rawIdea",
    question: "Describe your startup or project idea in your own words.",
    conversationalVariant: "Tell me the idea in one clear sentence: who is it for, and what would it help them do?",
    expectedAnswerType: "longText",
    isCritical: true,
    exampleGoodAnswer: "A tool that helps first-year engineering students plan study sessions around weak topics",
    exampleBadAnswer: "app, AI, startup",
    whyItMatters: "Creates the starting hypothesis the research agent will challenge.",
    quickSelect: ["I have no idea yet"],
  },
  {
    id: 10,
    field: "targetUser",
    question: "Who exactly is the target user?",
    conversationalVariant: "Who would feel this pain first? Be narrower than 'students', 'people', or 'businesses'.",
    expectedAnswerType: "text",
    isCritical: true,
    exampleGoodAnswer: "First-year engineering students who repeatedly fail internal exams",
    exampleBadAnswer: "everyone, people, students",
    whyItMatters: "A reachable first user is more useful than a huge imaginary market.",
    quickSelect: ["Not defined yet - I have no idea yet"],
  },
  {
    id: 11,
    field: "problem",
    question: "What painful problem does this solve for them?",
    conversationalVariant: "What specific frustration, cost, delay, or risk would this remove?",
    expectedAnswerType: "longText",
    isCritical: true,
    exampleGoodAnswer: "They do not know which weak topic to study next and waste limited revision time",
    exampleBadAnswer: "it is hard, bad experience",
    whyItMatters: "Problem intensity is a better early signal than feature excitement.",
    quickSelect: ["Not defined yet - I have no idea yet"],
  },
  {
    id: 12,
    field: "evidenceLevel",
    question: "What proof do you currently have that this problem is real?",
    conversationalVariant: "What evidence do you have so far? Honest 'no proof yet' is completely acceptable.",
    expectedAnswerType: "choice",
    isCritical: true,
    exampleGoodAnswer: "No proof yet; it is based on my own experience",
    exampleBadAnswer: "random",
    whyItMatters: "Separates a plausible belief from observed demand.",
    quickSelect: [
      "Only my own belief",
      "Personal experience",
      "Friends or classmates told me",
      "Online communities, posts, or reviews",
      "Competitors exist",
      "Surveys or interviews",
      "Users or revenue",
      "Research or data",
      "No proof yet",
    ],
  },
  {
    id: 13,
    field: "alternatives",
    question: "What alternatives do people currently use instead of your idea?",
    conversationalVariant: "How do they handle this today: another product, spreadsheets, manual work, a service, or doing nothing?",
    expectedAnswerType: "text",
    isCritical: false,
    exampleGoodAnswer: "YouTube videos, handwritten plans, and asking senior students",
    exampleBadAnswer: "idk, 0",
    whyItMatters: "The real competitor is often an existing habit, not another startup.",
    quickSelect: ["I do not know yet", "They do nothing", "Manual work", "Spreadsheets", "Existing apps"],
  },
  {
    id: 14,
    field: "thirtyDayGoal",
    question: "What would make this idea successful in the next 30 days?",
    conversationalVariant: "Choose one measurable 30-day outcome, such as five interviews, ten signups, or three active testers.",
    expectedAnswerType: "text",
    isCritical: false,
    exampleGoodAnswer: "Get five target users to test the prototype twice",
    exampleBadAnswer: "be successful, make money",
    whyItMatters: "Turns ambition into a falsifiable first milestone.",
  },
  {
    id: 15,
    field: "openToModification",
    question: "Are you open to LaunchPilot modifying, narrowing, or rejecting the idea if research shows the current version is weak?",
    conversationalVariant: "If the evidence is weak, are you open to narrowing, changing, or not building this version?",
    expectedAnswerType: "choice",
    isCritical: true,
    exampleGoodAnswer: "Yes, I am open to changing it",
    exampleBadAnswer: "idk",
    whyItMatters: "The research loop only works if the founder can respond honestly to evidence.",
    quickSelect: ["Yes, I am open", "No, keep the current idea"],
  },
];

export function getQuestionById(id: number) {
  return CORE_QUESTIONS.find((question) => question.id === id);
}

export function getQuestionByField(field: QuestionField) {
  return CORE_QUESTIONS.find((question) => question.field === field);
}
