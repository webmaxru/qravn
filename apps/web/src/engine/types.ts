import type { Assessment, AssessInput } from '../contracts/assessment';

export interface SafetyEngine {
  assess(input: AssessInput): Assessment;
  version(): string;
}

export type EngineMode = 'mock' | 'wasm';

export interface EngineInstance {
  engine: SafetyEngine;
  mode: EngineMode;
  message?: string;
}
