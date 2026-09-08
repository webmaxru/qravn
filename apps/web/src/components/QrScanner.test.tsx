import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QrScanner } from './QrScanner';

describe('QrScanner camera controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a pinch gesture to zoom the camera track instead of the page', async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 1 } }),
      applyConstraints,
      stop: vi.fn(),
    };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    render(<QrScanner onDecode={vi.fn()} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: /scan with camera/i }));
    const viewfinder = await screen.findByRole('region');
    await waitFor(() => expect(viewfinder).toHaveClass('viewfinder--live'));

    fireEvent.pointerDown(viewfinder, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewfinder, { pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewfinder, { pointerId: 2, clientX: 233, clientY: 100 });

    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] }));
  });
});
