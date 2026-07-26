import initWasm, { SafetyEngine as WasmSafetyEngineClass } from 'qrrrgh-safety-wasm';
import type { Assessment, AssessInput, EngineConfig, SafetyEngineWasm } from '../contracts/assessment';
import type { SafetyEngine } from './types';

export class WasmSafetyEngine implements SafetyEngine {
  private readonly inner: SafetyEngineWasm;

  private constructor(inner: SafetyEngineWasm) {
    this.inner = inner;
  }

  static async load(config: EngineConfig = {}): Promise<WasmSafetyEngine> {
    await initWasm();
    return new WasmSafetyEngine(new WasmSafetyEngineClass(JSON.stringify(config)) as SafetyEngineWasm);
  }

  assess(input: AssessInput): Assessment {
    return JSON.parse(this.inner.assess(JSON.stringify(input))) as Assessment;
  }

  version(): string {
    return this.inner.version();
  }

  free(): void {
    this.inner.free();
  }
}
