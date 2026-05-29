export interface Preset {
  id: string;
  label: string;
  icon: string;
  instruction: string;   // injected into Call 2 system prompt
  hint: string;          // shown as placeholder in custom instruction field
}
 
export const PRESETS: Preset[] = [
  {
    id: 'signals',
    label: '→ Signals',
    icon: '⚡',
    instruction: 'Migrate all state to Angular Signals. Replace BehaviorSubject, Subject, and Observable-based state with signal(), computed(), and effect(). Use toSignal() at boundaries where RxJS is still needed.',
    hint: 'e.g. "keep RxJS only for HTTP calls"',
  },
  {
    id: 'standalone',
    label: '→ Standalone',
    icon: '◈',
    instruction: 'Convert to standalone component architecture. Remove NgModule declarations. Add all required imports directly to the component. Use importProvidersFrom where needed.',
    hint: 'e.g. "keep shared module for now"',
  },
  {
    id: 'inject',
    label: '→ inject()',
    icon: '⊕',
    instruction: 'Replace all constructor injection with the inject() function. Remove constructor parameters for DI. Keep constructor only if it has non-DI logic.',
    hint: 'e.g. "also migrate to functional guards"',
  },
  {
    id: 'control-flow',
    label: '→ @if/@for',
    icon: '⊞',
    instruction: 'Replace all *ngIf and *ngFor structural directives with the new built-in control flow syntax (@if, @for, @switch). Add track by id to all @for loops. Remove CommonModule imports where NgIf/NgFor were the only used directives.',
    hint: 'e.g. "also replace ngSwitch"',
  },
  {
    id: 'async-signals',
    label: '→ toSignal()',
    icon: '∿',
    instruction: 'Replace async pipe usages with toSignal(). Use httpResource() for HTTP calls where applicable. Remove ChangeDetectorRef.markForCheck() calls made redundant by signals.',
    hint: 'e.g. "focus on template async pipes first"',
  },
];