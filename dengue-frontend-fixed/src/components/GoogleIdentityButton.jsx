import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Google Identity Services button. The backend independently verifies the ID token. */
export default function GoogleIdentityButton({ onCredential, text = 'continue_with' }) {
  const buttonRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [scriptError, setScriptError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return undefined;

    let cancelled = false;
    let timeoutId = null;
    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    const renderGoogleButton = () => {
      if (cancelled || !buttonRef.current) return;
      if (!window.google?.accounts?.id) {
        setScriptError('Google sign-in loaded incompletely. Check your connection or try loading it again.');
        if (script) script.dataset.gisLoadFailed = 'true';
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              Promise.resolve(callbackRef.current?.(response.credential)).catch((error) => {
                console.error('Google sign-in callback failed:', error);
              });
            }
          },
          error_callback: (error) => {
            console.warn('Google Identity Services popup error:', error?.type || 'unknown');
            if (!cancelled) {
              setScriptError('Google sign-in could not open. Allow pop-ups for this site and try again.');
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
        });

        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.max(200, Math.min(buttonRef.current.clientWidth || 320, 360)),
        });
        if (script) {
          script.dataset.gisLoaded = 'true';
          delete script.dataset.gisLoadFailed;
        }
        setScriptError('');
      } catch (error) {
        console.error('Google Identity Services initialization failed:', error?.message || error);
        setScriptError('Google sign-in could not initialize. Check the Google Web Client ID and authorized website origin in Google Cloud Console.');
      }
    };

    const handleLoad = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      renderGoogleButton();
    };

    const handleError = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (!cancelled) {
        if (script) script.dataset.gisLoadFailed = 'true';
        setScriptError('Google sign-in could not load. Check your internet connection or browser content blocker, then retry.');
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      if (script?.dataset.gisLoadFailed === 'true') {
        script.remove();
        script = null;
      }

      if (!script) {
        script = document.createElement('script');
        script.id = GOOGLE_SCRIPT_ID;
        script.src = GOOGLE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
      }

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      if (!script.isConnected) document.head.appendChild(script);

      timeoutId = window.setTimeout(() => {
        if (!cancelled && !window.google?.accounts?.id) {
          setScriptError('Google sign-in is taking too long to load. Check your connection or content blocker, then retry.');
        }
      }, 15000);

      // Covers a previously loaded script whose load event fired before this component mounted.
      if (script.dataset.gisLoaded === 'true') handleLoad();
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
      if (buttonRef.current) buttonRef.current.innerHTML = '';
    };
  }, [clientId, text, loadAttempt]);

  const retryGoogleLoad = () => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (!window.google?.accounts?.id && existingScript) existingScript.remove();
    setScriptError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (!clientId) {
    return (
      <div className="da-google-config-note" role="note">
        Google sign-in needs configuration. Set <code>REACT_APP_GOOGLE_CLIENT_ID</code> in the frontend environment and rebuild the app.
      </div>
    );
  }

  return (
    <div className="da-google-signin-wrap">
      <div className="da-google-signin-button" ref={buttonRef} />
      {scriptError && (
        <div className="da-google-signin-error" role="alert">
          <p>{scriptError}</p>
          <button type="button" onClick={retryGoogleLoad} className="da-google-retry">Try again</button>
        </div>
      )}
      <small>For Citizen accounts only.</small>
    </div>
  );
}
