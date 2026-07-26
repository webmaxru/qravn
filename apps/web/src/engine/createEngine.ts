import type { EngineConfig } from '../contracts/assessment';
import { MockSafetyEngine } from './mockSafetyEngine';
import type { EngineInstance } from './types';
import { WasmSafetyEngine } from './wasmSafetyEngine';

type WasmLoader = (config: EngineConfig) => Promise<WasmSafetyEngine>;

export class EngineStartupError extends Error {
  constructor(cause: unknown) {
    super('The real WebAssembly safety analyser could not start. No assessment can be given.');
    this.name = 'EngineStartupError';
    this.cause = cause;
  }
}

export async function createEngineWithLoader(
  config: EngineConfig = {},
  loadWasm: WasmLoader = WasmSafetyEngine.load,
  allowMockFallback = import.meta.env.DEV,
): Promise<EngineInstance> {
  try {
    const engine = await loadWasm(config);
    return { engine, mode: 'wasm' };
  } catch (error) {
    if (!allowMockFallback) throw new EngineStartupError(error);
    return {
      engine: new MockSafetyEngine(),
      mode: 'mock',
      message: 'Development mode: the Rust WebAssembly safety engine was not found, so this build is using the local TypeScript mock.',
    };
  }
}

export async function createEngine(config: EngineConfig = {}): Promise<EngineInstance> {
  return createEngineWithLoader(config);
}
