import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { decodeQrFromImage } from '../lib/qrDecoder';
import { t, td } from '../lib/uiText';
import type { Locale } from '../engine/catalog';
import { BrandMark } from './BrandMark';

interface QrScannerProps {
  onDecode: (payload: string) => void;
  locale: Locale;
  disabled?: boolean;
}

type CameraState = 'idle' | 'starting' | 'scanning';
type Status = { title: string; detail: string } | null;

/**
 * Seven DOMException names told the reader seven technical stories. There are
 * only three things a person can actually do about a camera that will not
 * start, so there are three messages.
 */
function cameraProblemCode(error: unknown): string {
  if (!window.isSecureContext) return 'ui.camera_problem';
  if (!(error instanceof DOMException)) return 'ui.camera_problem';
  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'ui.camera_denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'ui.camera_missing';
    default:
      return 'ui.camera_problem';
  }
}

export function QrScanner({ onDecode, locale, disabled = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const decodingRef = useRef(false);
  const scanningRef = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [status, setStatus] = useState<Status>(null);

  function stopCamera() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    decodingRef.current = false;
    scanningRef.current = false;
    setCameraState('idle');
  }

  useEffect(() => stopCamera, []);

  async function decodeFile(file: Blob) {
    setStatus({ title: t('ui.reading_image', locale), detail: '' });
    try {
      const decoded = await decodeQrFromImage(file);
      if (decoded) {
        setStatus(null);
        onDecode(decoded);
      } else {
        setStatus(td('ui.no_code_found', locale));
      }
    } catch {
      setStatus(td('ui.no_code_found', locale));
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = event.target.files ?? [];
    if (file) await decodeFile(file);
    event.target.value = '';
  }

  async function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const image = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'))?.getAsFile();
    if (image) {
      event.preventDefault();
      await decodeFile(image);
    }
  }

  async function startCamera() {
    if (!window.isSecureContext) {
      setStatus(td('ui.camera_problem', locale));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(td('ui.camera_missing', locale));
      return;
    }

    setCameraState('starting');
    setStatus({ title: t('ui.scan_starting', locale), detail: '' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      scanningRef.current = true;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState('scanning');
      setStatus({ title: t('ui.scan_aim', locale), detail: '' });
      scanNextFrame();
    } catch (error) {
      stopCamera();
      setStatus(td(cameraProblemCode(error), locale));
    }
  }

  async function decodeCurrentFrame(): Promise<string | null> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    if (detector) {
      try {
        const [result] = await detector.detect(video);
        if (result?.rawValue) return result.rawValue;
      } catch {
        // Fall through to the bundled WASM decoder.
      }
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return decodeQrFromImage(context.getImageData(0, 0, width, height));
  }

  function scanNextFrame() {
    frameRef.current = requestAnimationFrame(() => {
      if (!scanningRef.current) return;
      if (decodingRef.current) {
        scanNextFrame();
        return;
      }
      decodingRef.current = true;
      void decodeCurrentFrame()
        .then((decoded) => {
          if (decoded) {
            stopCamera();
            setStatus(null);
            onDecode(decoded);
            return;
          }
          decodingRef.current = false;
          scanNextFrame();
        })
        .catch(() => {
          // A frame that will not decode is the normal case while aiming, not
          // an error worth interrupting the reader for.
          decodingRef.current = false;
          scanNextFrame();
        });
    });
  }

  const live = cameraState !== 'idle';

  return (
    <section className="scan" aria-labelledby="scan-heading" onPaste={handlePaste}>
      <h2 id="scan-heading" className="visually-hidden">
        {t('ui.scan_target', locale)}
      </h2>

      {/* The frame, and the code you put inside it. The corners are a
          viewfinder and the mark is the subject, so the instruction is the
          picture — it does not depend on anyone reading a sentence. */}
      <div className={`viewfinder${live ? ' viewfinder--live' : ''}`}>
        <video ref={videoRef} className="viewfinder__video" playsInline muted aria-label={t('ui.scan_aim', locale)} />
        {live ? null : (
          <button type="button" className="viewfinder__target" onClick={() => void startCamera()} disabled={disabled}>
            <span className="viewfinder__glyph" aria-hidden="true">
              <BrandMark size={48} />
            </span>
            <span className="viewfinder__label">{t('ui.scan_start', locale)}</span>
          </button>
        )}
        <span className="viewfinder__corners" aria-hidden="true" />
      </div>

      <p className="scan-status" role="status">
        {status ? (
          <>
            <strong>{status.title}</strong>
            {status.detail ? <span className="scan-status__detail"> {status.detail}</span> : null}
          </>
        ) : null}
      </p>

      <div className="scan-actions">
        {live ? (
          <button type="button" onClick={stopCamera}>
            {t('ui.scan_stop', locale)}
          </button>
        ) : (
          <label className="file-picker">
            {t('ui.choose_photo', locale)}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handleFileChange(event)}
              disabled={disabled}
            />
          </label>
        )}
      </div>

      <canvas ref={canvasRef} hidden />
    </section>
  );
}
