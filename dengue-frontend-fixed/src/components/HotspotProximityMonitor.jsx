import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../axios';
import './HotspotProximityMonitor.css';

const OPT_IN_KEY = 'dengueAlert.hotspotAlerts.enabled';
const CHECK_MIN_INTERVAL_MS = 5000;
const MIN_MOVEMENT_METERS = 25;

function distanceMeters(a, b) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hotspotLabel(hotspot) {
  const parts = [hotspot?.corporation_code, hotspot?.ward_number ? `Ward ${hotspot.ward_number}` : null].filter(Boolean);
  return parts.join(' ') || `Hotspot #${hotspot?.hotspot_id}`;
}

export default function HotspotProximityMonitor() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const role = String(user?.role || '').trim().toLowerCase();
  const staffRole = ['master admin', 'councillor', 'inspector'].includes(role);
  const authOrPrivateRoute = ['/login', '/register', '/verify-email'].includes(pathname) || pathname.startsWith('/magistrate-alert');
  const canMonitor = !staffRole && !authOrPrivateRoute;
  const [tracking, setTracking] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState('');
  const [alertInfo, setAlertInfo] = useState(null);
  const watchIdRef = useRef(null);
  const lastCheckRef = useRef(null);
  const insideHotspotsRef = useRef(new Set());
  const mountedRef = useRef(true);
  const audioContextRef = useRef(null);

  // Create/resume audio only after the user clicks the location-alert button.
  // Browsers commonly block sound that starts without a user gesture.
  const prepareAlertAudio = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    } catch (error) {
      // Sound is optional; the visual alert must still work.
    }
  }, []);

  const playHotspotAlertSound = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state !== 'running') return;

    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = audioContext.currentTime;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, startAt);
      oscillator.frequency.setValueAtTime(660, startAt + 0.16);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.025);
      gain.gain.setValueAtTime(0.18, startAt + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.34);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.35);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch (error) {
      // Sound is optional; the visual alert must still work.
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    localStorage.removeItem(OPT_IN_KEY);
    insideHotspotsRef.current = new Set();
    lastCheckRef.current = null;
    setTracking(false);
    setMessage('Location alerts are turned off.');
  }, []);

  const sendSystemNotification = useCallback(async (hotspot, radiusMeters) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = 'Dengue Alert';
    const body = `Please be careful about mosquito bites. You are within ${radiusMeters} metres of an active dengue hotspot (${hotspotLabel(hotspot)}).`;
    const options = {
      body,
      tag: `dengue-hotspot-${hotspot.hotspot_id}`,
      renotify: false,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: { hotspot_id: hotspot.hotspot_id },
    };

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        return;
      } catch (error) {
        // Fall back to a page notification where the browser supports it.
      }
    }

    try {
      new Notification(title, options);
    } catch (error) {
      // The in-app alert remains visible even if OS notifications are unavailable.
    }
  }, []);

  const checkNearbyHotspots = useCallback(async (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const now = Date.now();
    const previous = lastCheckRef.current;
    if (previous && now - previous.checkedAt < CHECK_MIN_INTERVAL_MS &&
        distanceMeters(previous, { latitude, longitude }) < MIN_MOVEMENT_METERS) {
      return;
    }
    lastCheckRef.current = { latitude, longitude, checkedAt: now };

    try {
      const response = await api.get('/hotspots/nearby', { params: { latitude, longitude } });
      const nearby = Array.isArray(response.data?.data) ? response.data.data : [];
      const currentIds = new Set(nearby.map((hotspot) => String(hotspot.hotspot_id)));
      const newlyEntered = nearby.find((hotspot) => !insideHotspotsRef.current.has(String(hotspot.hotspot_id)));
      insideHotspotsRef.current = currentIds;

      if (newlyEntered) {
        const radius = Number(response.data?.radius_meters) || 200;
        const nextAlert = {
          hotspot: newlyEntered,
          radius,
          text: `Please be careful about mosquito bites. You are within ${radius} metres of an active dengue hotspot (${hotspotLabel(newlyEntered)}).`,
        };
        if (mountedRef.current) setAlertInfo(nextAlert);
        playHotspotAlertSound();
        await sendSystemNotification(newlyEntered, radius);
      } else if (!nearby.length && mountedRef.current) {
        const radius = Number(response.data?.radius_meters) || 200;
        setMessage(`Location alerts are active. No active dengue hotspot is within ${radius} metres of your current location.`);
      }
    } catch (error) {
      if (mountedRef.current) {
        setMessage(error.response?.data?.message || 'Could not check nearby hotspots. Location monitoring will retry as you move.');
      }
    }
  }, [playHotspotAlertSound, sendSystemNotification]);

  const startTracking = useCallback(async (requestPermissions = true) => {
    if (requestPermissions) prepareAlertAudio();

    if (!('geolocation' in navigator)) {
      setMessage('This browser does not support live location. Try a modern mobile browser.');
      return;
    }

    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setMessage('');

    if (requestPermissions && 'Notification' in window && Notification.permission === 'default') {
      // Initiate this from the user's click, but do not await it before asking
      // for geolocation so the browser's location prompt retains user activation.
      Notification.requestPermission().catch(() => {});
    }

    localStorage.setItem(OPT_IN_KEY, 'true');
    setCollapsed(false);
    setTracking(true);
    setMessage('Waiting for your location…');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        checkNearbyHotspots(position);
      },
      (error) => {
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        localStorage.removeItem(OPT_IN_KEY);
        setTracking(false);
        if (error.code === error.PERMISSION_DENIED) {
          setMessage('Location permission was denied. Allow location access in your browser settings to enable hotspot alerts.');
        } else if (error.code === error.TIMEOUT) {
          setMessage('Getting your location timed out. Check your GPS/location settings and try again.');
        } else {
          setMessage('Your location is unavailable. Check GPS/location settings and try again.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, [checkNearbyHotspots, prepareAlertAudio]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const resumeIfPreviouslyEnabled = async () => {
      if (!canMonitor || localStorage.getItem(OPT_IN_KEY) !== 'true') return;
      // Never trigger a browser permission prompt automatically on page load.
      // Resume silently only when the browser already reports permission granted.
      if (!navigator.permissions?.query) return;
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (!cancelled && permission.state === 'granted') await startTracking(false);
      } catch (error) {
        // User can still enable tracking manually from the panel.
      }
    };

    if (!canMonitor && watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      insideHotspotsRef.current = new Set();
      setAlertInfo(null);
      setTracking(false);
    }
    resumeIfPreviouslyEnabled();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    };
  }, [canMonitor, startTracking]);

  const activeLabel = alertInfo ? hotspotLabel(alertInfo.hotspot) : '';
  const rawActiveDistance = alertInfo?.hotspot?.distance_meters;
  const activeDistanceLabel = rawActiveDistance !== undefined && rawActiveDistance !== null && Number.isFinite(Number(rawActiveDistance))
    ? Math.round(Number(rawActiveDistance))
    : alertInfo?.radius;

  if (!canMonitor) return null;

  return (
    <aside className={`ha-proximity-panel${collapsed && !alertInfo ? ' ha-proximity-panel--collapsed' : ''}`} aria-label="Dengue hotspot proximity alerts">
      {alertInfo && (
        <div className="ha-proximity-alert" role="alert">
          <div className="ha-proximity-alert-icon" aria-hidden="true">!</div>
          <div className="ha-proximity-alert-copy">
            <strong>Nearby dengue hotspot</strong>
            <p>{alertInfo.text}</p>
            <small>{activeDistanceLabel} m away · {activeLabel}</small>
          </div>
          <button type="button" className="ha-proximity-dismiss" onClick={() => setAlertInfo(null)} aria-label="Dismiss hotspot alert">×</button>
        </div>
      )}

      {collapsed && !alertInfo ? (
        <button type="button" className="ha-proximity-pill" onClick={() => setCollapsed(false)}>Hotspot alerts</button>
      ) : (
        <div className="ha-proximity-card">
          <div className="ha-proximity-card-heading">
            <span className={`ha-proximity-dot${tracking ? ' ha-proximity-dot--active' : ''}`} />
            <strong>{tracking ? 'Hotspot alerts enabled' : 'Nearby dengue hotspot alerts'}</strong>
            <button type="button" className="ha-proximity-collapse" onClick={() => setCollapsed(true)} aria-label="Minimize hotspot alert panel">−</button>
          </div>
          <p>{tracking
            ? 'Your location is checked while this app is open. You will be warned when you enter 200 metres of an active hotspot.'
            : 'Allow location while using this app to receive a warning when you come within 200 metres of an active hotspot.'}</p>
          {message && <small className="ha-proximity-message" role="status">{message}</small>}
          <div className="ha-proximity-actions">
            {!tracking ? (
              <button type="button" className="ha-proximity-enable" onClick={() => startTracking(true)}>Allow location alerts</button>
            ) : (
              <button type="button" className="ha-proximity-disable" onClick={stopTracking}>Turn off alerts</button>
            )}
            {!tracking && <button type="button" className="ha-proximity-not-now" onClick={() => setCollapsed(true)}>Not now</button>}
          </div>
        </div>
      )}
    </aside>
  );
}
