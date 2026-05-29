import { Injectable, resource } from '@angular/core';
 
const GUIDELINES_URL = '/angular-guidelines.md';
 
// Sections we actually need — reduces tokens on every API call
const RELEVANT_SECTIONS = [
  'Signals',
  'inject(',
  'standalone',
  'control flow',
  '@if',
  '@for',
  'OnPush',
  'ChangeDetection',
  'toSignal',
  'httpResource',
];
 
@Injectable({ providedIn: 'root' })
export class AngularGuidelinesService {
  // resource() — Angular 19+. Loads once, reactive to deps changes.
  private readonly guidelinesResource = resource({
    loader: async () => {
      const response = await fetch(GUIDELINES_URL);
      if (!response.ok) throw new Error(`Failed to load guidelines: ${response.status}`);
      return response.text();
    },
  });
 
  readonly isLoading = this.guidelinesResource.isLoading;
  readonly error = this.guidelinesResource.error;
 
  /**
   * Returns full guidelines text, or null while loading.
   */
  getFullGuidelines(): string | null {
    return this.guidelinesResource.value() ?? null;
  }
 
  /**
   * Returns only the sections relevant to the detected issues.
   * Used in Call 2 (Refactorer) to reduce token usage ~40%.
   */
  getRelevantSections(ruleIds: string[]): string {
    const full = this.guidelinesResource.value();
    if (!full) return '';
 
    const lines = full.split('\n');
    const result: string[] = [];
    let inRelevantSection = false;
    let sectionDepth = 0;
 
    for (const line of lines) {
      const isHeading = line.startsWith('#');
 
      if (isHeading) {
        const isRelevant = RELEVANT_SECTIONS.some(s =>
          line.toLowerCase().includes(s.toLowerCase())
        ) || ruleIds.some(id => line.toLowerCase().includes(id.toLowerCase()));
 
        inRelevantSection = isRelevant;
        sectionDepth = (line.match(/^#+/) ?? [''])[0].length;
      }
 
      if (inRelevantSection) {
        result.push(line);
      }
    }
 
    return result.join('\n') || full.slice(0, 8000); // fallback: first 8k chars
  }
}
 