export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
 
export interface CodeIssue {
  id: string;
  line: number | null;
  severity: Severity;
  rule: string;
  title: string;
  description: string;
  impact: string;
  suggestion: string;
  // ── Audit depth ──────────────────────────────────────────────────────────
  whyItMatters: string;    // e.g. "Violates single responsibility; makes unit testing impossible without mocking the constructor"
  alternatives: string[];  // e.g. ["Use inject() function", "Use InjectionToken with factory"]
  tradeoffs: string;       // e.g. "inject() is simpler but requires injection context; InjectionToken gives explicit control"
}
 
export interface AnalysisResult {
  issues: CodeIssue[];
  summary: string;
  angularVersion: string | null;
  totalScore: number;
  tokenUsage: TokenUsage;
}
 
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}
 
export interface RefactoringResult {
  refactoredTs: string;
  refactoredHtml: string;
  refactoredScss: string;
  explanations: RefactoringExplanation[];
  tokenUsage: TokenUsage;
}
 
export interface RefactoringExplanation {
  issueId: string;
  change: string;
  reason: string;
}
 
// Tool Use schema for Call 1 (Analyzer)
export const ANALYZE_CODE_TOOL = {
  name: 'analyze_angular_code',
  description: 'Analyze Angular code for issues, anti-patterns, and improvement opportunities based on official Angular guidelines.',
  input_schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:           { type: 'string' },
            line:         { type: ['number', 'null'] },
            severity:     { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
            rule:         { type: 'string' },
            title:        { type: 'string' },
            description:  { type: 'string' },
            impact:       { type: 'string' },
            suggestion:   { type: 'string' },
            whyItMatters: {
              type: 'string',
              description: 'Reference to a specific Angular principle, guideline, or engineering concept explaining WHY this is a problem. Be specific — name the principle.',
            },
            alternatives: {
              type: 'array',
              items: { type: 'string' },
              description: '2–3 concrete alternative approaches to fix this issue.',
            },
            tradeoffs: {
              type: 'string',
              description: 'Concise comparison of the alternatives: what each gains and gives up in terms of performance, readability, testability, or maintainability.',
            },
          },
          required: [
            'id', 'severity', 'rule', 'title', 'description',
            'impact', 'suggestion', 'whyItMatters', 'alternatives', 'tradeoffs',
          ],
        },
      },
      summary:        { type: 'string' },
      angularVersion: { type: ['string', 'null'] },
      totalScore: {
        type: 'number',
        description: '0–100. 100 = modern, idiomatic Angular 22 code. Scoring: deduct 25 per critical, 10 per high, 5 per medium, 2 per low issue.',
      },
    },
    required: ['issues', 'summary', 'totalScore'],
  },
};
 