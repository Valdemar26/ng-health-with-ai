import { Injectable, inject } from '@angular/core';
import { AnalysisResult, ANALYZE_CODE_TOOL, TokenUsage } from '../models/analysis.model';
import { AngularGuidelinesService } from './angular-guidelines.service';
 
const COST_INPUT_PER_1M  = 3.0;   // USD, claude-sonnet-4
const COST_OUTPUT_PER_1M = 15.0;
 
@Injectable({ providedIn: 'root' })
export class CodeAnalyzerService {
  private readonly guidelines = inject(AngularGuidelinesService);
 
  async analyze(tsCode: string, htmlCode: string, scssCode: string): Promise<AnalysisResult> {
    const guidelinesText = this.guidelines.getFullGuidelines() ?? '';
    const userContent    = this.buildUserContent(tsCode, htmlCode, scssCode);
 
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.buildSystemPrompt(guidelinesText),
        tools: [ANALYZE_CODE_TOOL],
        tool_choice: { type: 'tool', name: 'analyze_angular_code' },
        messages: [{ role: 'user', content: userContent }],
      }),
    });
 
    if (!response.ok) throw new Error(`API error: ${response.status}`);
 
    const data = await response.json();
 
    const toolBlock = data.content.find(
      (b: { type: string }) => b.type === 'tool_use'
    );
    if (!toolBlock) throw new Error('No tool_use block in response');
 
    return {
      ...toolBlock.input,
      tokenUsage: this.calcTokenUsage(data.usage),
    } as AnalysisResult;
  }
 
  private buildUserContent(ts: string, html: string, scss: string): string {
    const parts: string[] = [];
    if (ts.trim())   parts.push(`### TypeScript (.ts)\n\`\`\`typescript\n${ts.trim()}\n\`\`\``);
    if (html.trim()) parts.push(`### Template (.html)\n\`\`\`html\n${html.trim()}\n\`\`\``);
    if (scss.trim()) parts.push(`### Styles (.scss)\n\`\`\`scss\n${scss.trim()}\n\`\`\``);
    return parts.join('\n\n');
  }
 
  private buildSystemPrompt(guidelines: string): string {
    return `You are a senior Angular engineer and code reviewer with deep expertise in Angular 17–22.
 
Your role is not just to list problems — but to help the developer understand the engineering principles behind each issue.
 
For every issue you find:
- Explain WHY it is a problem by referencing a specific principle, Angular guideline, or engineering concept (e.g. "This violates the Single Responsibility Principle", "Angular 14+ recommends inject() over constructor injection per the official style guide", "This prevents OnPush change detection from working correctly").
- Provide 2–3 concrete alternative approaches.
- Compare the trade-offs: what does each alternative gain or give up in terms of performance, readability, testability, or maintainability.
 
## Severity guide
- critical: breaks functionality, causes memory leaks, security vulnerability, or runtime errors
- high: significant performance impact or blocks modern Angular patterns (e.g. prevents signals migration)
- medium: best practice violation, technical debt, modernization needed
- low: style, minor optimization, readability
- info: nice-to-have suggestion, optional improvement
 
## What to look for
- Signals migration opportunities (BehaviorSubject, manual subscriptions, async pipe → toSignal)
- inject() vs constructor injection
- Standalone component architecture
- New control flow syntax (@if, @for, @switch) vs structural directives
- OnPush change detection correctness
- Memory leaks (unsubscribed observables, missing takeUntilDestroyed)
- Missing trackBy / track in loops
- TypeScript strictness issues
- Unnecessary zone.js triggers
 
## Scoring
Start at 100. Deduct: 25 per critical, 10 per high, 5 per medium, 2 per low.
 
---
 
## Official Angular Guidelines
 
${guidelines}`;
  }
 
  private calcTokenUsage(usage: { input_tokens: number; output_tokens: number }): TokenUsage {
    const inputTokens  = usage?.input_tokens  ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    return {
      inputTokens,
      outputTokens,
      estimatedCostUsd:
        (inputTokens  / 1_000_000) * COST_INPUT_PER_1M +
        (outputTokens / 1_000_000) * COST_OUTPUT_PER_1M,
    };
  }
}
 