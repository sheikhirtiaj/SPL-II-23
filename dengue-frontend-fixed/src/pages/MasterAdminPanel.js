import React, { useEffect, useState } from 'react';
import api from '../axios';

// Master Admin dashboard section: shows every registered Councillor (with ward
// and complaint stats) and Inspector, and lets the Master Admin add new ones.
// Backend routes used: GET /users/staff, POST /users/create-staff (Master Admin only).
const MasterAdminPanel = () => {
  const [councillors, setCouncillors] = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    role: 'Councillor',
    ward_id: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formError, setFormError] = useState('');

  const fetchStaff = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const res = await api.get('/users/staff');
      setCouncillors(res.data?.data?.councillors || []);
      setInspectors(res.data?.data?.inspectors || []);
    } catch (err) {
      setLoadError(
        err.response?.data?.message ||
          'Could not load Councillor/Inspector list. This dashboard needs the new /users/staff backend endpoint.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setFormMsg('');
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        role: form.role,
        password: form.password,
        ward_id: form.role === 'Councillor' ? form.ward_id || null : null,
      };

      const res = await api.post('/users/create-staff', payload);
      setFormMsg(res.data?.message || `${form.role} added successfully`);
      setForm({ full_name: '', email: '', phone_number: '', role: 'Councillor', ward_id: '', password: '' });
      fetchStaff();
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          'Could not create the account. This needs the new /users/create-staff backend endpoint.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Councillors & Inspectors</h2>
        <button
          onClick={fetchStaff}
          className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {loadError && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-200 text-sm">
          {loadError}
        </div>
      )}

      {loading && <p className="text-gray-500 mb-4">Loading...</p>}

      {/* Councillors list */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-2">Councillors</h3>
        {!loading && councillors.length === 0 && !loadError && (
          <p className="text-gray-500 text-sm">No councillors registered yet.</p>
        )}
        <div className="space-y-2">
          {councillors.map((c) => (
            <div
              key={c.user_id}
              className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            >
              <div>
                <p className="font-semibold text-gray-900">{c.full_name}</p>
                <p className="text-sm text-gray-500">Ward {c.ward_id ?? 'Not assigned'}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-700">
                  Received: <strong>{c.complaints_received}</strong>
                </span>
                <span className="text-green-700">
                  Resolved: <strong>{c.complaints_resolved}</strong>
                </span>
                <span className="text-yellow-700">
                  Pending: <strong>{c.complaints_pending}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inspectors list */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-2">Inspectors</h3>
        {!loading && inspectors.length === 0 && !loadError && (
          <p className="text-gray-500 text-sm">No inspectors registered yet.</p>
        )}
        <div className="space-y-2">
          {inspectors.map((i) => (
            <div
              key={i.user_id}
              className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            >
              <p className="font-semibold text-gray-900">{i.full_name}</p>
              <div className="flex gap-4 text-sm">
                <span className="text-gray-700">
                  Assigned: <strong>{i.complaints_assigned}</strong>
                </span>
                <span className="text-green-700">
                  Resolved: <strong>{i.complaints_resolved}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add new Councillor / Inspector */}
      <div className="border-t pt-4">
        <h3 className="font-semibold text-gray-800 mb-3">Add Councillor / Inspector</h3>

        {formMsg && (
          <div className="mb-3 p-2 bg-green-100 text-green-800 rounded border border-green-200 text-sm">
            {formMsg}
          </div>
        )}
        {formError && (
          <div className="mb-3 p-2 bg-red-100 text-red-800 rounded border border-red-200 text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Full Name"
            className="p-2 border rounded"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="p-2 border rounded"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Phone Number"
            className="p-2 border rounded"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            required
          />
          <select
            className="p-2 border rounded"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="Councillor">Councillor</option>
            <option value="Inspector">Inspector</option>
          </select>

          {form.role === 'Councillor' && (
            <input
              type="number"
              placeholder="Ward Number"
              className="p-2 border rounded"
              value={form.ward_id}
              onChange={(e) => setForm({ ...form, ward_id: e.target.value })}
              required
            />
          )}

          <div className={form.role === 'Councillor' ? '' : 'md:col-span-2'}>
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
            className="md:col-span-2 bg-green-600 text-white p-2 rounded hover:bg-green-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding...' : 'Add Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MasterAdminPanel;
