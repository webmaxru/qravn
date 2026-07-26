import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface InputFormProps {
  onSubmit: (payload: string) => void;
  disabled?: boolean;
}

export function InputForm({ onSubmit, disabled = false }: InputFormProps) {
  const [payload, setPayload] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(payload);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit(payload);
    }
  }

  return (
    <form className="check-form" onSubmit={submit}>
      <label htmlFor="payload">Paste a suspicious link or QR payload</label>
      <textarea
        id="payload"
        value={payload}
        rows={5}
        placeholder="https://dnb.no@evil.example/login"
        onChange={(event) => setPayload(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p className="form-help">Nothing is opened while checking. Press Enter or the button to check. Use Shift+Enter for a new line.</p>
      <button type="submit" className="primary-action" disabled={disabled}>Check</button>
    </form>
  );
}
