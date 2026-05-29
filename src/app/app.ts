// src/app/app.ts

import {
  Component, inject, signal, computed, linkedSignal, ChangeDetectionStrategy
} from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { CodeAnalyzerService }   from './core/services/code-analyzer.service';
import { CodeRefactorerService } from './core/services/code-refactorer.service';
import { AngularGuidelinesService } from './core/services/angular-guidelines.service';

import { AnalysisResult, RefactoringResult } from './core/models/analysis.model';
import { Preset, PRESETS } from './core/models/preset.model';

type ActiveTab  = 'ts' | 'html' | 'scss';
type AppPhase   = 'idle' | 'analyzing' | 'analyzed' | 'refactoring' | 'done' | 'error';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly analyzer    = inject(CodeAnalyzerService);
  private readonly refactorer  = inject(CodeRefactorerService);
  readonly guidelinesService   = inject(AngularGuidelinesService);

  // ── UI state ──────────────────────────────────────────────────────────────
  readonly activeTab    = signal<ActiveTab>('ts');
  readonly phase        = signal<AppPhase>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly presets      = PRESETS;

  // ── Code input ────────────────────────────────────────────────────────────
  readonly tsCode   = signal('');
  readonly htmlCode = signal('');
  readonly scssCode = signal('');

  // ── Preset & instruction ──────────────────────────────────────────────────
  readonly selectedPreset     = signal<Preset | null>(null);
  readonly customInstruction  = linkedSignal(() => '');
  readonly instructionHint    = computed(() =>
    this.selectedPreset()?.hint ?? 'Add any extra instruction, e.g. "focus on duplicate logic"'
  );

  // ── Results ───────────────────────────────────────────────────────────────
  readonly analysisResult    = signal<AnalysisResult | null>(null);
  readonly refactoringResult = signal<RefactoringResult | null>(null);

  readonly streamingOutput = this.refactorer.streamingOutput;
  readonly isStreaming      = this.refactorer.isStreaming;

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly hasCode = computed(() =>
    this.tsCode().trim().length > 0 ||
    this.htmlCode().trim().length > 0 ||
    this.scssCode().trim().length > 0
  );

  readonly issuesBySeverity = computed(() => {
    const issues = this.analysisResult()?.issues ?? [];
    return {
      critical: issues.filter(i => i.severity === 'critical'),
      high:     issues.filter(i => i.severity === 'high'),
      medium:   issues.filter(i => i.severity === 'medium'),
      low:      issues.filter(i => i.severity === 'low'),
      info:     issues.filter(i => i.severity === 'info'),
    };
  });

  readonly scoreColor = computed(() => {
    const score = this.analysisResult()?.totalScore ?? 100;
    if (score >= 80) return 'score--good';
    if (score >= 50) return 'score--medium';
    return 'score--bad';
  });

  readonly totalCostFormatted = computed(() => {
    const a = this.analysisResult()?.tokenUsage.estimatedCostUsd ?? 0;
    const r = this.refactoringResult()?.tokenUsage.estimatedCostUsd ?? 0;
    return `$${(a + r).toFixed(4)}`;
  });

  readonly tabs = ['ts', 'html', 'scss'] as const;

  // ── Actions ───────────────────────────────────────────────────────────────
  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  selectPreset(preset: Preset): void {
    this.selectedPreset.set(
      this.selectedPreset()?.id === preset.id ? null : preset
    );
  }

  async runAnalysis(): Promise<void> {
    if (!this.hasCode()) return;
    this.phase.set('analyzing');
    this.errorMessage.set(null);
    this.analysisResult.set(null);
    this.refactoringResult.set(null);

    try {
      const result = await this.analyzer.analyze(
        this.tsCode(), this.htmlCode(), this.scssCode()
      );
      this.analysisResult.set(result);
      this.phase.set('analyzed');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Analysis failed');
      this.phase.set('error');
    }
  }

  async runRefactoring(): Promise<void> {
    const analysis = this.analysisResult();
    if (!analysis) return;
    this.phase.set('refactoring');

    try {
      const result = await this.refactorer.refactor(
        this.tsCode(), this.htmlCode(), this.scssCode(),
        analysis,
        this.selectedPreset(),
        this.customInstruction(),
      );
      this.refactoringResult.set(result);
      this.phase.set('done');
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Refactoring failed');
      this.phase.set('error');
    }
  }

  reset(): void {
    this.tsCode.set('');
    this.htmlCode.set('');
    this.scssCode.set('');
    this.analysisResult.set(null);
    this.refactoringResult.set(null);
    this.selectedPreset.set(null);
    this.customInstruction.set('');
    this.phase.set('idle');
    this.errorMessage.set(null);
    this.refactorer.streamingOutput.set('');
  }
}