import { Injectable, inject, signal } from '@angular/core';
import { AnalysisResult, RefactoringResult, TokenUsage } from '../models/analysis.model';
import { Preset } from '../models/preset.model';
import { AngularGuidelinesService } from './angular-guidelines.service';
 
@Injectable({ providedIn: 'root' })
export class CodeRefactorerService {
  private readonly guidelines = inject(AngularGuidelinesService);
 
  // Streaming state — components bind to these signals
  readonly streamingOutput = signal('');
  readonly isStreaming = signal(false);
  readonly streamError = signal<string | null>(null);
 
  async refactor(
    tsCode: string,
    htmlCode: string,
    scssCode: string,
    analysis: AnalysisResult,
    preset: Preset | null,
    customInstruction: string,
  ): Promise<RefactoringResult> {
    this.isStreaming.set(true);
    this.streamingOutput.set('');
    this.streamError.set(null);
 
    // Only send guidelines sections relevant to found issues
    const ruleIds = analysis.issues.map(i => i.rule);
    const relevantGuidelines = this.guidelines.getRelevantSections(ruleIds);
 
    const systemPrompt = this.buildSystemPrompt(relevantGuidelines, preset, customInstruction);
    const userContent = this.buildUserContent(tsCode, htmlCode, scssCode, analysis);
 
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
 
      if (!response.ok) throw new Error(`API error: ${response.status}`);
 
      const result = await this.consumeStream(response);
      return result;
 
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.streamError.set(message);
      throw err;
    } finally {
      this.isStreaming.set(false);
    }
  }
 
  private async consumeStream(response: Response): Promise<RefactoringResult> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
 
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
 
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
 
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
 
          try {
            const parsed = JSON.parse(raw);
 
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              fullText += parsed.delta.text;
              this.streamingOutput.set(fullText);
            }
 
            if (parsed.type === 'message_delta' && parsed.usage) {
              outputTokens = parsed.usage.output_tokens ?? 0;
            }
 
            if (parsed.type === 'message_start' && parsed.message?.usage) {
              inputTokens = parsed.message.usage.input_tokens ?? 0;
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }
    }
 
    return this.parseRefactoringOutput(fullText, { inputTokens, outputTokens });
  }
 
  private parseRefactoringOutput(
    text: string,
    usage: { inputTokens: number; outputTokens: number }
  ): RefactoringResult {
    // Parse structured sections from the streamed markdown response
    const tsMatch = text.match(/```typescript\n([\s\S]*?)```/);
    const htmlMatch = text.match(/```html\n([\s\S]*?)```/);
    const scssMatch = text.match(/```scss\n([\s\S]*?)```/);
 
    // Parse explanations block
    const explanationSection = text.match(/## Explanations\n([\s\S]*?)(?=##|$)/);
    const explanations = this.parseExplanations(explanationSection?.[1] ?? '');
 
    const tokenUsage: TokenUsage = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd:
        (usage.inputTokens / 1_000_000) * 3.0 +
        (usage.outputTokens / 1_000_000) * 15.0,
    };
 
    return {
      refactoredTs:   tsMatch?.[1]?.trim() ?? '',
      refactoredHtml: htmlMatch?.[1]?.trim() ?? '',
      refactoredScss: scssMatch?.[1]?.trim() ?? '',
      explanations,
      tokenUsage,
    };
  }
 
  private parseExplanations(section: string) {
    // Parses lines like: "- [issue-id] Change description — Reason"
    return section
      .split('\n')
      .filter(l => l.startsWith('- '))
      .map((line, i) => {
        const match = line.match(/- \[(.+?)\] (.+?) — (.+)/);
        return {
          issueId: match?.[1] ?? `auto-${i}`,
          change:  match?.[2] ?? line,
          reason:  match?.[3] ?? '',
        };
      });
  }
 
  private buildSystemPrompt(guidelines: string, preset: Preset | null, custom: string): string {
    const presetInstruction = preset
      ? `Primary refactoring goal: ${preset.instruction}`
      : 'Apply all applicable Angular best practices.';
 
    const customBlock = custom.trim()
      ? `\nAdditional instruction from user: ${custom.trim()}`
      : '';
 
    return `You are an expert Angular developer performing a code refactoring.
 
${presetInstruction}${customBlock}
 
Output format — respond with these sections in order:
 
1. If TypeScript code was provided:
\`\`\`typescript
// refactored code here
\`\`\`
 
2. If HTML template was provided:
\`\`\`html
<!-- refactored code here -->
\`\`\`
 
3. If SCSS was provided:
\`\`\`scss
// refactored code here
\`\`\`
 
4. Always include:
## Explanations
- [issue-id] What changed — Why this change was made
(one line per change, format exactly as shown)
 
Be thorough. Include all original functionality. Do not remove features.
 
---
 
## Relevant Angular Guidelines
 
${guidelines}`;
  }
 
  private buildUserContent(
    ts: string,
    html: string,
    scss: string,
    analysis: AnalysisResult,
  ): string {
    const issuesSummary = analysis.issues
      .map(i => `- [${i.id}] ${i.severity.toUpperCase()}: ${i.title} — ${i.suggestion}`)
      .join('\n');
 
    const codeParts: string[] = [];
    if (ts.trim())   codeParts.push(`### TypeScript\n\`\`\`typescript\n${ts.trim()}\n\`\`\``);
    if (html.trim()) codeParts.push(`### Template\n\`\`\`html\n${html.trim()}\n\`\`\``);
    if (scss.trim()) codeParts.push(`### Styles\n\`\`\`scss\n${scss.trim()}\n\`\`\``);
 
    return `Please refactor the following Angular code.
 
## Issues found by analyzer
${issuesSummary}
 
## Code to refactor
${codeParts.join('\n\n')}`;
  }
}
 