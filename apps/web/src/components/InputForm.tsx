import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { t } from '../lib/uiText';
import type { Locale } from '../engine/catalog';

interface InputFormProps {
  onSubmit: (payload: string) => void;
  locale: Locale;
  disabled?: boolean;
}

export function InputForm({ onSubmit, locale, disabled = false }: InputFormProps) {
  const [payload, setPayload] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(payload);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // The submit button is disabled until the analyser is ready. Without this
      // guard the keyboard path bypassed that gate, so a keyboard user could
      // submit while a pointer user could not, and the check silently produced
      // nothing because no engine existed yet.
      if (disabled) return;
      onSubmit(payload);
    }
  }

  return (
    <form className="check-form" onSubmit={submit}>
      <label htmlFor="payload">{t('ui.paste_label', locale)}</label>
      <textarea
        id="payload"
        value={payload}
        rows={3}
        placeholder={t('ui.paste_placeholder', locale)}
        onChange={(event) => setPayload(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" disabled={disabled}>
        {t('ui.check', locale)}
      </button>
    </form>
  );
}
