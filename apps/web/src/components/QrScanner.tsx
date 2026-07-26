import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { decodeQrFromImage } from '../lib/qrDecoder';

interface QrScannerProps {
  onDecode: (payload: string) => void;
  disabled?: boolean;
}

type CameraState = 'idle' | 'starting' | 'scanning';

function explainCameraError(error: unknown): string {
  if (!window.isSecureContext) {
    return 'Camera scanning requires a secure context. Use HTTPS or localhost, or paste/upload an image instead.';
  }
  if (!(error instanceof DOMException)) {
    return 'The camera could not be started. Paste a payload or upload an image instead.';
  }
  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. You can still paste a payload or upload a QR screenshot.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. Paste a payload or upload a QR screenshot instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use or unavailable. Close other camera apps, or use paste/upload.';
    case 'OverconstrainedError':
      return 'No rear-facing camera matched the request. Try another camera or upload an image.';
    default:
      return 'The camera could not be started. Paste a payload or upload an image instead.';
  }
}

export function QrScanner({ onDecode, disabled = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const decodingRef = useRef(false);
  const scanningRef = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [message, setMessage] = useState('Upload or paste a QR image, or start the camera.');

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
    setMessage('Decoding QR image locally…');
    try {
      const decoded = await decodeQrFromImage(file);
      if (decoded) {
        setMessage('QR code decoded locally.');
        onDecode(decoded);
      } else {
        setMessage('No QR code was found in that image. Try a clearer screenshot or paste the text.');
      }
    } catch {
      setMessage('The image could not be decoded. Try another image or paste the QR payload text.');
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
      setMessage(explainCameraError(new DOMException('Insecure context', 'SecurityError')));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('This browser does not expose camera access. Upload a QR image or paste the payload instead.');
      return;
    }

    setCameraState('starting');
    setMessage('Requesting camera permission…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      scanningRef.current = true;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState('scanning');
      setMessage('Point the camera at a QR code. Frames are decoded locally only.');
      scanNextFrame();
    } catch (error) {
      stopCamera();
      setMessage(explainCameraError(error));
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
            setMessage('QR code decoded locally. Camera stopped.');
            onDecode(decoded);
            return;
          }
          decodingRef.current = false;
          scanNextFrame();
        })
        .catch(() => {
          decodingRef.current = false;
          setMessage('Could not decode this frame. Keep the QR code steady or upload an image.');
          scanNextFrame();
        });
    });
  }

  return (
    <section className="panel scanner" aria-labelledby="scanner-heading" onPaste={handlePaste}>
      <h2 id="scanner-heading">Scan a QR code</h2>
      <p>{message}</p>
      <div className="scanner-actions">
        <button type="button" onClick={() => void startCamera()} disabled={disabled || cameraState !== 'idle'}>
          {cameraState === 'idle' ? 'Start camera' : 'Camera starting…'}
        </button>
        {cameraState !== 'idle' ? <button type="button" onClick={stopCamera}>Stop camera</button> : null}
        <label className="file-picker">
          Upload QR image
          <input type="file" accept="image/*" onChange={(event) => void handleFileChange(event)} disabled={disabled} />
        </label>
      </div>
      <video ref={videoRef} className="camera-preview" playsInline muted aria-label="Camera preview" />
      <canvas ref={canvasRef} hidden />
    </section>
  );
}
