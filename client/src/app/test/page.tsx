'use client';

import { useState, useEffect } from 'react';

/**
 * Test Page - Clean slate for testing components and features
 * Access at: http://localhost:3000/test
 */

// Common timezones list
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function TestPage() {
  const [showModal, setShowModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState({
    customLocation: '',
    deviceID: '',
    name: '',
    timezone: 'UTC',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [geoLocation, setGeoLocation] = useState<[number, number] | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Check if already authenticated on mount
  useEffect(() => {
    const authData = localStorage.getItem('purecare_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.idToken) {
          setIsAuthenticated(true);
        }
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  // Automatically get location when modal opens
  useEffect(() => {
    if (showModal && !geoLocation) {
      getLocation();
    }
  }, [showModal]);

  // Get user's geolocation
  const getLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setGeoLocation([lat, lon]);
        setGeoLoading(false);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setGeoError(errorMessage);
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const handleSetAuth = () => {
    if (!authToken.trim()) {
      alert('Please enter an auth token');
      return;
    }

    // Store the token in localStorage in the same format as the app uses
    const authData = {
      idToken: authToken,
      profile: {
        name: 'Test User',
        email: 'test@example.com',
      },
    };

    localStorage.setItem('auth', JSON.stringify(authData));
    setIsAuthenticated(true);
    setShowAuthModal(false);
    alert('Auth token set! You can now register devices.');
  };

  const handleRegisterDevice = async () => {
    // Validate required fields
    if (!formData.deviceID.trim()) {
      setResult({ type: 'error', message: 'Device ID is required' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Get the auth token from localStorage (assuming it's stored there)
      const authData = localStorage.getItem('purecare_auth');
      let idToken = null;

      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          idToken = parsed.idToken;
        } catch (e) {
          console.error('Failed to parse auth data', e);
        }
      }

      if (!idToken) {
        throw new Error('Not authenticated. Please log in first.');
      }

      // Make API call to backend
      const response = await fetch('http://localhost:3020/api/devices/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          customLocation: formData.customLocation || 'Bedroom',
          deviceID: formData.deviceID,
          name: formData.name || 'New Device',
          timezone: formData.timezone,
          geo: geoLocation || [null, null], // Use user's location if available
          measurements: {}, // Optional: will be populated by device
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register device');
      }

      setResult({
        type: 'success',
        message: `Device registered successfully! Device ID: ${data.deviceId}`,
      });

      // Reset form
      setFormData({
        customLocation: '',
        deviceID: '',
        name: '',
        timezone: 'UTC',
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowModal(false);
        setResult(null);
      }, 2000);
    } catch (error: any) {
      setResult({
        type: 'error',
        message: error.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          Test Page
        </h1>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 32 }}>
          Clean slate for testing - Device Registration
        </p>

        {/* Auth Status */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: isAuthenticated
              ? 'rgba(34, 197, 94, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isAuthenticated ? '#22c55e' : '#ef4444'}`,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Authentication Status:{' '}
            {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {isAuthenticated
              ? 'You can now register devices'
              : 'Set auth token to register devices'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowAuthModal(true)}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: 'white',
              border: '1px solid var(--divider)',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Set Auth Token
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={!isAuthenticated}
            style={{
              padding: '12px 24px',
              background: isAuthenticated ? '#4f46e5' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: isAuthenticated ? 'pointer' : 'not-allowed',
              opacity: isAuthenticated ? 1 : 0.5,
            }}
          >
            Register Device
          </button>
          {isAuthenticated && (
            <button
              onClick={() => {
                const authData = localStorage.getItem('purecare_auth');
                if (authData) {
                  const token = JSON.parse(authData).idToken;
                  navigator.clipboard.writeText(token);
                  alert('Token copied to clipboard!');
                }
              }}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                color: 'white',
                border: '1px solid var(--divider)',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy Token
            </button>
          )}
        </div>
      </div>

      {/* Auth Token Modal */}
      {showAuthModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Set Auth Token
            </h2>
            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              To get your Google ID token:
              <br />
              1. Go to <a href="/login" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Login Page</a> and sign in
              <br />
              2. Open browser DevTools (F12) → Console tab
              <br />
              3. Run: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>JSON.parse(localStorage.getItem('purecare_auth')).idToken</code>
              <br />
              4. Copy the token and paste it here
            </p>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                ID Token
              </label>
              <textarea
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Paste your Firebase ID token here..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--divider)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'inherit',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowAuthModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--divider)',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSetAuth}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#4f46e5',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Set Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
              Register New Device
            </h2>

            {/* Form Fields */}
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Device ID */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Device ID *
                </label>
                <input
                  type="text"
                  value={formData.deviceID}
                  onChange={(e) =>
                    setFormData({ ...formData, deviceID: e.target.value })
                  }
                  placeholder="Enter device ID"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--divider)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Device Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Living Room Purifier"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--divider)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Custom Location */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Custom Location
                </label>
                <input
                  type="text"
                  value={formData.customLocation}
                  onChange={(e) =>
                    setFormData({ ...formData, customLocation: e.target.value })
                  }
                  placeholder="e.g., Bedroom, Kitchen"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--divider)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Timezone */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--divider)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Geolocation */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Location (Latitude, Longitude)
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={loading || geoLoading}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--divider)',
                      background: geoLocation
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(79, 70, 229, 0.1)',
                      color: geoLocation ? '#22c55e' : '#4f46e5',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: loading || geoLoading ? 'not-allowed' : 'pointer',
                      opacity: loading || geoLoading ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {geoLoading
                      ? 'Getting...'
                      : geoLocation
                        ? '✓ Got Location'
                        : 'Get My Location'}
                  </button>
                  <div style={{ flex: 1, fontSize: 13, opacity: 0.8 }}>
                    {geoLocation
                      ? `${geoLocation[0].toFixed(4)}, ${geoLocation[1].toFixed(4)}`
                      : geoError
                        ? geoError
                        : 'Click to get your location'}
                  </div>
                </div>
              </div>

              {/* Result Message */}
              {result && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background:
                      result.type === 'success'
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${result.type === 'success' ? '#22c55e' : '#ef4444'}`,
                    color: result.type === 'success' ? '#22c55e' : '#ef4444',
                    fontSize: 14,
                  }}
                >
                  {result.message}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => !loading && setShowModal(false)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--divider)',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterDevice}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#4f46e5',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? 'Registering...' : 'Register Device'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
