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

// Public self-registration is for Citizens only. Staff accounts are created by
// a Master Admin, so the role is fixed and is not a user-facing choice.
const Register = () => {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'Citizen',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordChecks = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /[a-z]/.test(form.password),
    /\d/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ];
  const passwordStrength = passwordChecks.filter(Boolean).length;
  const strengthLabel = !form.password ? 'Not entered' : passwordStrength <= 2 ? 'Weak' : passwordStrength <= 4 ? 'Medium' : 'Strong';
  const { register, googleSignIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim()) {
      setError('Please provide your email address.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8 || form.password.length > 128 || passwordChecks.slice(1).filter(Boolean).length < 3) {
      setError('Choose a stronger password: use at least 8 characters and combine letters, numbers, and symbols.');
      return;
    }

    setSubmitting(true);

    try {
      await register({
        full_name: form.full_name,
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
      });
      navigate(`/verify-email?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setGoogleSubmitting(true);
    try {
      await googleSignIn(credential);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Google sign-up failed');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <main className="da-auth-page da-auth-page--register">
      <header className="da-auth-header">
        <Link to="/" className="da-auth-brand" aria-label="Dengue Alert home">
          <span className="da-auth-brand-icon"><ShieldMark size={23} /></span>
          <span className="da-auth-brand-copy">
            <strong>Dengue Alert</strong>
            <small>Community reporting</small>
          </span>
        </Link>
        <Link to="/login" className="da-auth-header-link">Already registered? <strong>Sign in</strong></Link>
      </header>

      <div className="da-auth-content">
        <div className="da-auth-layout">
          <section className="da-auth-aside">
            <div className="da-auth-eyebrow"><span className="da-auth-eyebrow-dot" /> COMMUNITY HEALTH AND SAFETY</div>
            <h1>Small actions. <span>Safer communities.</span></h1>
            <p>Create your citizen account to report potential mosquito breeding sites and follow the response to your reports.</p>
            <div className="da-auth-assurance">
              <span className="da-auth-assurance-icon"><ShieldMark size={20} /></span>
              <span><strong>Your voice helps your neighbourhood.</strong><small>Submit concerns and keep track of their progress.</small></span>
            </div>
            <div className="da-auth-aside-footnote"><span className="da-auth-live-dot" /> Registration is for community members.</div>
          </section>

          <section className="da-auth-card" aria-labelledby="register-heading">
            <div className="da-auth-card-heading">
              <span className="da-auth-card-kicker">GET STARTED</span>
              <h2 id="register-heading">Create your account</h2>
              <p>Register with your name, email address, and a password.</p>
            </div>

            {error && <div className="da-auth-error" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="da-auth-form">
              <div className="da-auth-field">
                <label htmlFor="register-full-name">Full name</label>
                <input
                  id="register-full-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  placeholder="Enter your full name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="da-auth-field">
                <label htmlFor="register-email">Email address</label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setForm((old) => ({ ...old, email: completeBareEmail(old.email) }))}
                  list="register-email-suggestions"
                  required
                />
                <datalist id="register-email-suggestions">
                  {buildEmailSuggestions(form.email).map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </div>

              <div className="da-auth-field">
                <label htmlFor="register-password">Password</label>
                <div className="da-password-input-wrap">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    placeholder="Create a strong password"
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
                <div className="da-password-strength" aria-live="polite">
                  <div className="da-password-strength-track"><span style={{ width: `${passwordStrength * 20}%` }} className={`da-password-strength-fill strength-${passwordStrength}`} /></div>
                  <small>Password strength: <strong>{strengthLabel}</strong>. Use 8+ characters, uppercase and lowercase letters, a number, and a symbol.</small>
                </div>
                <label htmlFor="register-confirm-password">Confirm password</label>
                <div className="da-password-input-wrap">
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Re-enter your password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    required
                  />
                  <PasswordVisibilityToggle
                    className="da-password-toggle"
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((value) => !value)}
                    fieldLabel="confirm password"
                  />
                </div>
                {form.confirmPassword && <small className={form.password === form.confirmPassword ? 'da-password-match' : 'da-password-mismatch'}>{form.password === form.confirmPassword ? 'Passwords match' : 'Passwords do not match'}</small>}
              </div>

              <button type="submit" disabled={submitting} className="da-auth-submit">
                {submitting ? 'Creating account…' : 'Create account'} <span aria-hidden="true">→</span>
              </button>
            </form>

            <div className="da-auth-divider"><span>or</span></div>
            <GoogleIdentityButton onCredential={handleGoogleCredential} text="signup_with" />
            {googleSubmitting && <p className="da-google-signin-pending" role="status">Creating your Citizen account…</p>}

            <div className="da-auth-card-footer">
              <span>Already have an account?</span> <Link to="/login">Sign in</Link>
            </div>
            <Link to="/" className="da-auth-home-link">← Back to home</Link>
          </section>
        </div>
      </div>
      <footer className="da-auth-footer">Dengue Alert <span>·</span> Community reporting for safer neighbourhoods</footer>
    </main>
  );
};

export default Register;