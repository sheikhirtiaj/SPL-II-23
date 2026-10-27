import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import GoogleIdentityButton from '../../components/GoogleIdentityButton';
import PasswordVisibilityToggle from '../../components/PasswordVisibilityToggle';
import '../ThemePages.css';

const ShieldMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

// Convenience email shortcuts used on the auth pages.
const TEST_EMAIL_ALIASES = ['irtiazcitizen', 'rehanworker'];
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com'];

// Suggest full email addresses while typing: alias shortcuts first, then
// whatever was typed completed with each common domain. Typing "aa" offers
// "aa@gmail.com", "aa@yahoo.com", "aa@outlook.com" (plus alias matches).
const buildEmailSuggestions = (value) => {
  const typed = value.trim().toLowerCase();
  if (!typed) return TEST_EMAIL_ALIASES.map((alias) => `${alias}@gmail.com`);

  const atIndex = typed.indexOf('@');
  const local = atIndex === -1 ? typed : typed.slice(0, atIndex);
  const domain = atIndex === -1 ? '' : typed.slice(atIndex + 1);
  if (!local) return [];

  const suggestions = [];

  if (!domain) {
    TEST_EMAIL_ALIASES.forEach((alias) => {
      if (alias.startsWith(local)) suggestions.push(`${alias}@gmail.com`);
    });
  }

  EMAIL_DOMAINS.forEach((d) => {
    if (domain && !d.startsWith(domain)) return;
    suggestions.push(`${local}@${d}`);
  });

  return [...new Set(suggestions)].slice(0, 6);
};

// Leaving the field with a bare name (no @) completes it to a Gmail address.
// This also covers the test shortcuts: "irtiazcitizen" -> "irtiazcitizen@gmail.com".
const completeBareEmail = (value) => {
  const typed = value.trim().toLowerCase();
  return typed && !typed.includes('@') ? `${typed}@gmail.com` : value;
};

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const { login, googleSignIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedInUser = await login(form.email, form.password);
      const role = String(loggedInUser.role || '').toLowerCase();
      if (role === 'councillor') navigate('/councillor');
      else if (role === 'inspector') navigate('/inspector');
      else if (role === 'master admin') navigate('/admin');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setGoogleSubmitting(true);
    try {
      const loggedInUser = await googleSignIn(credential);
      const role = String(loggedInUser.role || '').toLowerCase();
      if (role === 'citizen') navigate('/dashboard');
      else if (role === 'councillor') navigate('/councillor');
      else if (role === 'inspector') navigate('/inspector');
      else if (role === 'master admin') navigate('/admin');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google sign-in failed');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <main className="da-auth-page">
      <header className="da-auth-header">
        <Link to="/" className="da-auth-brand" aria-label="Dengue Alert home">
          <span className="da-auth-brand-icon"><ShieldMark size={23} /></span>
          <span className="da-auth-brand-copy">
            <strong>Dengue Alert</strong>
            <small>Community reporting</small>
          </span>
        </Link>
        <Link to="/register" className="da-auth-header-link">Create an account <span aria-hidden="true">→</span></Link>
      </header>

      <div className="da-auth-content">
        <div className="da-auth-layout">
          <section className="da-auth-aside">
            <div className="da-auth-eyebrow"><span className="da-auth-eyebrow-dot" /> COMMUNITY HEALTH AND SAFETY</div>
            <h1>Welcome back to a <span>safer community.</span></h1>
            <p>Sign in to report mosquito breeding risks, track complaints, and help local teams respond to dengue concerns.</p>
            <div className="da-auth-assurance">
              <span className="da-auth-assurance-icon"><ShieldMark size={20} /></span>
              <span><strong>One community. One shared goal.</strong><small>Clear reporting helps the right people take action.</small></span>
            </div>
            <div className="da-auth-aside-footnote"><span className="da-auth-live-dot" /> Community reports help local teams respond.</div>
          </section>

          <section className="da-auth-card" aria-labelledby="login-heading">
            <div className="da-auth-card-heading">
              <span className="da-auth-card-kicker">YOUR ACCOUNT</span>
              <h2 id="login-heading">Sign in</h2>
              <p>Enter your email address and password to continue.</p>
            </div>

            {error && <div className="da-auth-error" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="da-auth-form">
              <div className="da-auth-field">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setForm((old) => ({ ...old, email: completeBareEmail(old.email) }))}
                  list="login-email-suggestions"
                  required
                />
                <datalist id="login-email-suggestions">
                  {buildEmailSuggestions(form.email).map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div className="da-auth-field">
                <label htmlFor="login-password">Password</label>
                <div className="da-password-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <PasswordVisibilityToggle
                    className="da-password-toggle"
                    visible={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                    fieldLabel="password"
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="da-auth-submit">
                {submitting ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span>
              </button>
            </form>

            <div className="da-auth-divider"><span>or</span></div>
            <GoogleIdentityButton onCredential={handleGoogleCredential} text="continue_with" />
            {googleSubmitting && <p className="da-google-signin-pending" role="status">Signing in with Google…</p>}

            <div className="da-auth-card-footer">
              <Link to="/verify-email">Resend verification email</Link>
            </div>
            <div className="da-auth-card-footer">
              <span>New to Dengue Alert?</span> <Link to="/register">Create an account</Link>
            </div>
            <Link to="/" className="da-auth-home-link">← Back to home</Link>
          </section>
        </div>
      </div>
      <footer className="da-auth-footer">Dengue Alert <span>·</span> Community reporting for safer neighbourhoods</footer>
    </main>
  );
};

export default Login;