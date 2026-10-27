export type BookId = 'dean' | 'amor' | 'pollack' | 'banzhaf' | 'kaplan' | 'prosperidade' | 'saude';
export type StudySource = { book: BookId; pages: number[]; note: string };
export type CardArticle = {
  id: number;
  subtitle: string;
  overview: string[];
  symbolism: { title: string; text: string }[];
  domains: { professional: string[]; health: string[]; love: string[]; financial: string[] };
  advice: string[];
  shadow: string[];
  study: { questions: string[]; exercise: string; connections: { cardId: number; text: string }[] };
  sources: StudySource[];
};
export type MethodArticle = {
  id: string;
  subtitle: string;
  introduction: string[];
  suitable: string[];
  preparation: string[];
  positions: { title: string; description: string; question: string }[];
  sequence: string[];
  example: { question: string; cards: { cardId: number; position: string; interpretation: string }[]; synthesis: string[] };
  pitfalls: { title: string; text: string }[];
  practice: string[];
  sources: StudySource[];
  externalSources?: { title: string; url: string; note: string }[];
  traditionNote?: string;
};
