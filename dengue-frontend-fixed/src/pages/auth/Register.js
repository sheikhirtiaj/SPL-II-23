import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// NOTE: Public self-registration is for Citizens only. Councillor, Inspector,
// and Master Admin accounts are provisioned separately (created directly in
// the database / by a Master Admin), so the role is fixed here and is no
// longer a user-facing choice.
const Register = () => {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    role: 'Citizen',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Backend now only requires ONE of email / phone_number (not both).
    // Mirror that rule here so the user gets instant feedback.
    if (!form.email?.trim() && !form.phone_number?.trim()) {
      setError('Please provide either an email or a phone number.');
      return;
    }

    setSubmitting(true);

    try {
      await register({
       ...form,
       email: form.email || null,
       phone_number: form.phone_number || null
      });

      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold text-center text-blue-700">Dengue Alert System</h1>
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Register</h2>
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full p-2 border rounded"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <p className="text-xs text-gray-500 -mt-2">
            Provide at least one of email or phone number.
          </p>
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 border rounded"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="text"
            placeholder="Phone Number"
            className="w-full p-2 border rounded"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
          />
          <div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="w-full p-2 border rounded"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 select-none">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Show password
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
