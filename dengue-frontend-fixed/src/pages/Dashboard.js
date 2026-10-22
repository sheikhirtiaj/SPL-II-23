import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../axios';

const verifyRoles = ['Master Admin'];

const getStatusClass = (status) => {
  switch (status) {
    case 'Resolved':
      return 'bg-green-100 text-green-800';
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'Assigned':
      return 'bg-blue-100 text-blue-800';
    case 'Pending Verification':
      return 'bg-purple-100 text-purple-800';
    case 'Re-assigned':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatDate = (dateValue) => {
  if (!dateValue) {
    return 'Unknown date';
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState([]);
  // CHANGED: removed longitude, latitude, before_photo_url from form state
  const [form, setForm] = useState({
    description: '',
  });
  const [afterPhotoUrls, setAfterPhotoUrls] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [beforePhoto, setBeforePhoto] = useState(null);
  const [location, setLocation] = useState({
  longitude: null,
  latitude: null
  });
  const [inspectorIds, setInspectorIds] = useState({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loadingReports, setLoadingReports] = useState(false);

  const notify = (text, type = 'success') => {
    if (type === 'error') {
      setError(text);
      setMsg('');
    } else {
      setMsg(text);
      setError('');
    }

    setTimeout(() => {
      setMsg('');
      setError('');
    }, 4500);
  };

  const fetchReports = async () => {
    setLoadingReports(true);

    try {
      const res = await api.get('/reports');
      setReports(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load reports from backend', 'error');
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
  if (
    cameraOpen &&
    videoRef.current &&
    streamRef.current
  ) {
    videoRef.current.srcObject = streamRef.current;
  }
}, [cameraOpen]);

  // Role-based routing: dedicated dashboards for Councillor and Inspector
  // Must be after all hooks to comply with React Rules of Hooks
  if (user?.role === 'Councillor') return <Navigate to="/councillor" replace />;
  if (user?.role === 'Inspector') return <Navigate to="/inspector" replace />;

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude
        });
      },
      (error) => {
        console.error("Location error:", error);
        alert("Please allow location access.");
      }
    );
  };

    const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    streamRef.current = stream;
    setCameraOpen(true);

  } catch (error) {
    console.error("Camera error:", error);
    notify("Camera permission is required.", "error");
  }
};

const stopCamera = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  setCameraOpen(false);
};

const capturePhoto = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;

  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");

  context.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  canvas.toBlob(
    (blob) => {
      if (!blob) return;

      const file = new File(
        [blob],
        `hazard-${Date.now()}.jpg`,
        {
          type: "image/jpeg"
        }
      );

      setBeforePhoto(file);

      setPhotoPreview(
        URL.createObjectURL(blob)
      );

      stopCamera();
    },
    "image/jpeg",
    0.9
  );
};

    const handleCreate = async (e) => {
    e.preventDefault();

    if (location.latitude === null || location.longitude === null) {
      notify("Please get your current location before submitting.", "error");
      return;
    }

    if (!beforePhoto) {
      notify("Please select a photo.", "error");
      return;
    }

    try {
      const formData = new FormData();

      formData.append("description", form.description);
      formData.append("longitude", location.longitude);
      formData.append("latitude", location.latitude);
      formData.append("before_photo", beforePhoto);

      const res = await api.post("/reports", formData);

      notify(res.data?.message || "Report submitted successfully");

      setForm({ description: "" });
      setBeforePhoto(null);

      setLocation({
        longitude: null,
        latitude: null
      });

      fetchReports();

    } catch (err) {
      console.error(err);

      notify(
        err.response?.data?.message || "Failed to submit report",
        "error"
      );
    }
  };

  const handleAssign = async (reportId) => {
    const inspectorId = inspectorIds[reportId];

    if (!inspectorId) {
      notify('Enter an Inspector ID', 'error');
      return;
    }

    try {
      const res = await api.patch(`/reports/${reportId}/assign`, {
        inspector_id: Number(inspectorId),
      });

      notify(res.data?.message || 'Task assigned successfully');
      setInspectorIds((current) => ({ ...current, [reportId]: '' }));
      fetchReports();
    } catch (err) {
      fetchReports();
      notify(
        err.response?.data?.message ||
          'Assignment request reached the backend, but the backend did not return a success response',
        'error'
      );
    }
  };

  const handleAfterPhoto = async (reportId) => {
    const afterPhotoUrl = afterPhotoUrls[reportId]?.trim();

    if (!afterPhotoUrl) {
      notify('Enter the After Photo URL', 'error');
      return;
    }

    try {
      const res = await api.patch(`/reports/${reportId}`, {
        after_photo_url: afterPhotoUrl,
      });

      notify(res.data?.message || 'After photo uploaded');
      setAfterPhotoUrls((current) => ({ ...current, [reportId]: '' }));
      fetchReports();
    } catch (err) {
      notify(err.response?.data?.message || 'Upload failed', 'error');
    }
  };

  const handleVerify = async (reportId, approved) => {
    try {
      const res = await api.patch(`/reports/${reportId}/verify`, {
        is_approved: approved,
      });

      notify(res.data?.message || (approved ? 'Report resolved' : 'Report rejected and re-assigned'));
      fetchReports();
    } catch (err) {
      notify(err.response?.data?.message || 'Verification failed', 'error');
    }
  };

  const canVerify = verifyRoles.includes(user?.role);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">Dengue Alert System</h1>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-gray-700">
                Welcome, <strong>{user.full_name}</strong>{' '}
                <span className="text-sm text-gray-500">({user.role})</span>
              </span>
            )}

            {user ? (
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            ) : (
              <div className="space-x-2">
                <Link
                  to="/login"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {msg && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded border border-green-200">
            {msg}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-200">
            {error}
          </div>
        )}

        {!user && (
          <div className="bg-white p-4 rounded shadow mb-6 text-gray-700">
            Login to access role based actions. Public reports are still shown below.
          </div>
        )}

        {user?.role === 'Citizen' && (
          <div className="bg-white p-6 rounded shadow mb-6">
            <h2 className="text-xl font-bold mb-4">Report a Hotspot</h2>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">

              <input
                type="text"
                placeholder="Description"
                className="p-2 border rounded"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                required
              />

            {!cameraOpen && !photoPreview && (
              <button
                type="button"
                onClick={startCamera}
                className="bg-purple-600 text-white p-2 rounded"
              >
                Open Camera
              </button>
            )}

            {cameraOpen && (
              <div className="flex flex-col gap-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-h-96 bg-black rounded"
                />

                <button
                  type="button"
                  onClick={capturePhoto}
                  className="bg-purple-600 text-white p-2 rounded"
                >
                  Capture Photo
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="bg-gray-500 text-white p-2 rounded"
                >
                  Cancel Camera
                </button>
              </div>
            )}

            <canvas
              ref={canvasRef}
              style={{ display: "none" }}
            />

            {photoPreview && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-green-700">
                  Photo captured successfully
                </p>

                <img
                  src={photoPreview}
                  alt="Captured hazard"
                  className="w-full max-h-80 object-contain rounded border"
                />

                <button
                  type="button"
                  onClick={() => {
                    setBeforePhoto(null);
                    setPhotoPreview(null);
                    startCamera();
                  }}
                  className="bg-gray-600 text-white p-2 rounded"
                >
                  Retake Photo
                </button>
              </div>
            )}

              <button
                type="button"
                onClick={getCurrentLocation}
                className="bg-green-600 text-white p-2 rounded"
              >
                Get Current Location
              </button>

              {location.latitude && location.longitude && (
                <p className="text-sm text-green-700">
                  Location captured successfully
                </p>
              )}

              <button
                type="submit"
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-semibold"
              >
                Submit Report
              </button>

            </form>
          </div>
        )}

        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">All Reports</h2>
            <button
              onClick={fetchReports}
              className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            {loadingReports && <p className="text-gray-500">Loading reports...</p>}
            {!loadingReports && reports.length === 0 && <p className="text-gray-500">No reports yet.</p>}

            {reports.map((r) => (
              <div key={r.report_id} className="border rounded p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-gray-900">#{r.report_id}</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusClass(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-1">{r.description}</p>
                  <p className="text-sm text-gray-500 mb-2">
                    Ward {r.ward_id || 'N/A'} - {formatDate(r.created_at)}
                  </p>

                  <div className="flex gap-2 flex-wrap">
                    {r.before_photo_url && (
                      <img
                        src={r.before_photo_url}
                        alt="Before"
                        className="w-24 h-24 object-cover rounded border"
                      />
                    )}
                    {r.after_photo_url && (
                      <img
                        src={r.after_photo_url}
                        alt="After"
                        className="w-24 h-24 object-cover rounded border"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-w-[220px]">
                  {user?.role === 'Councillor' && r.status === 'Pending' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Assign to Inspector</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="ID"
                          className="p-1 border rounded w-20"
                          value={inspectorIds[r.report_id] || ''}
                          onChange={(e) =>
                            setInspectorIds((current) => ({ ...current, [r.report_id]: e.target.value }))
                          }
                        />
                        <button
                          onClick={() => handleAssign(r.report_id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  )}

                  {user?.role === 'Inspector' &&
                    r.status === 'Assigned' &&
                    Number(r.assigned_inspector_id) === Number(user.user_id) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-600">Upload After Photo</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="URL"
                            className="p-1 border rounded flex-1"
                            value={afterPhotoUrls[r.report_id] || ''}
                            onChange={(e) =>
                              setAfterPhotoUrls((current) => ({
                                ...current,
                                [r.report_id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            onClick={() => handleAfterPhoto(r.report_id)}
                            className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    )}

                  {canVerify && r.status === 'Pending Verification' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-600">Verify Cleanup</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerify(r.report_id, true)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleVerify(r.report_id, false)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;