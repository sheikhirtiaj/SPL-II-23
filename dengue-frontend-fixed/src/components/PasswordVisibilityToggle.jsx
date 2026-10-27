import React from 'react';

/** Consistent, accessible show/hide password control shared by auth and admin forms. */
export default function PasswordVisibilityToggle({
  visible,
  onToggle,
  className,
  fieldLabel = 'password',
}) {
  const action = visible ? 'Hide' : 'Show';

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={`${action} ${fieldLabel}`}
      aria-pressed={visible}
      title={`${action} ${fieldLabel}`}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-3.1 4.2" />
          <path d="M6.2 6.2C4.2 7.5 3 9.6 3 12c0 2 4 7 9 7 1.2 0 2.3-.3 3.3-.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
