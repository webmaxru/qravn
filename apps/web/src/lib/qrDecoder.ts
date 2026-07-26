import { prepareZXingModule, readBarcodes, type ReadResult } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

let prepared = false;

function prepareDecoder() {
  if (prepared) return;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? new URL(wasmUrl, window.location.href).href : prefix + path),
    },
  });
  prepared = true;
}

export async function decodeQrFromImage(input: Blob | ImageData): Promise<string | null> {
  prepareDecoder();
  const results = await readBarcodes(input, {
    formats: ['QRCode'],
    maxNumberOfSymbols: 1,
    tryHarder: true,
  });
  return firstQrText(results);
}

function firstQrText(results: ReadResult[]): string | null {
  return results.find((result) => result.text.trim().length > 0)?.text ?? null;
}
