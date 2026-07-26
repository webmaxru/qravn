import { describe, expect, it } from 'vitest';
import { createEngineWithLoader, EngineStartupError } from './createEngine';

describe('createEngineWithLoader', () => {
  it('does not return a mock engine when production wasm loading fails', async () => {
    await expect(
      createEngineWithLoader({}, async () => {
        throw new Error('wasm unavailable');
      }, false),
    ).rejects.toBeInstanceOf(EngineStartupError);
  });
});
