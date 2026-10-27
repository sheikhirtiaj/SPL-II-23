import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../axios';
import '../ThemePages.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [message, setMessage] = useState(token ? 'Click Verify email to activate your account.' : 'Check your inbox for the verification link, then open it.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  async function verify() {
    setError(''); setBusy(true);
    try {
      const response = await api.post('/users/verify-email', { token });
      setVerified(true);
      setMessage(response.data?.message || 'Email verified. You can now sign in.');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not verify email. Request a new link.');
    } finally { setBusy(false); }
  }

  async function resend(event) {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      const response = await api.post('/users/resend-verification', { email });
      setMessage(response.data?.message || 'Check your inbox for a new link.');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not resend verification email.');
    } finally { setBusy(false); }
  }

  // Avoid automatically redeeming email links (which can be crawled by mail scanners).
  useEffect(() => { document.title = 'Verify email | Dengue Alert'; }, []);

  return (
    <main className="da-auth-page">
      <header className="da-auth-header"><Link className="da-auth-brand" to="/">Dengue Alert</Link></header>
      <div className="da-auth-content"><div className="da-auth-layout">
        <section className="da-auth-aside"><h1>Verify your <span>email address.</span></h1><p>Activate your Citizen account securely before signing in.</p></section>
        <section className="da-auth-card">
          <div className="da-auth-card-heading"><h2>Email verification</h2><p role="status">{message}</p></div>
          {error && <div className="da-auth-error" role="alert">{error}</div>}
          {token && !verified && <button className="da-auth-submit" type="button" disabled={busy} onClick={verify}>{busy ? 'Verifying…' : 'Verify email'}</button>}
          {verified && <Link to="/login" className="da-auth-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Continue to sign in</Link>}
          {!verified && <form className="da-auth-form" onSubmit={resend}>
            <div className="da-auth-field"><label htmlFor="verify-email-address">Need a new link?</label><input id="verify-email-address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></div>
            <button className="da-auth-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Resend verification email'}</button>
          </form>}
          <div className="da-auth-card-footer"><Link to="/login">Back to sign in</Link></div>
        </section>
      </div></div>
    </main>
  );
}
