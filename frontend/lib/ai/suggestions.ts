import suggestionConfig from "./suggested-questions.json";

export interface SuggestedQuestion {
  category: string;
  question: string;
  color: string;
  borderHover: string;
}

export const SUGGESTIONS = suggestionConfig as SuggestedQuestion[];

export const SUGGESTION_QUESTIONS = new Set(
  SUGGESTIONS.map((suggestion) => suggestion.question),
);

export function isSuggestedQuestion(question: string): boolean {
  return SUGGESTION_QUESTIONS.has(question.trim());
}
