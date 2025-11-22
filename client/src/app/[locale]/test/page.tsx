'use client';

import { useState, useEffect } from 'react';

/**
 * Test Page - Clean slate for testing components and features
 * Access at: http://localhost:3000/test
 *
 * Features:
 * - Device registration with AQI integration
 * - Auto-detect timezone from geolocation
 * - Fetch nearest air quality station
 */

export default function TestPage() {
  const [showModal, setShowModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState({
    customLocation: '',
    deviceID: '',
    name: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [geoLocation, setGeoLocation] = useState<[number, number] | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // Check if already authenticated on mount
  useEffect(() => {
    const authData = localStorage.getItem('purecare_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.idToken) {
          setIsAuthenticated(true);
          fetchDevices(); // Fetch devices on auth
        }
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  // Fetch user's devices
  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const authData = localStorage.getItem('purecare_auth');
      if (!authData) return;

      const parsed = JSON.parse(authData);
      const idToken = parsed.idToken;

      const response = await fetch('http://localhost:3020/api/devices', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns devices array directly, not wrapped in an object
        setDevices(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setDevicesLoading(false);
    }
  };

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
            errorMessage =
              'Location permission denied. Please enable location access.';
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
      const response = await fetch(
        'http://localhost:3020/api/devices/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            deviceID: formData.deviceID,
            name: formData.name || 'New Device',
            customLocation: formData.customLocation || 'Bedroom',
            geo: geoLocation || [null, null], // Timezone auto-detected from AQI API
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register device');
      }

      setResult({
        type: 'success',
        message: `Device registered successfully! Device ID: ${data.deviceID || formData.deviceID}`,
      });

      // Reset form
      setFormData({
        customLocation: '',
        deviceID: '',
        name: '',
      });
      setGeoLocation(null);

      // Refresh device list
      fetchDevices();

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

        {/* My Devices Section */}
        {isAuthenticated && (
          <div style={{ marginTop: 48 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>My Devices</h2>
              <button
                onClick={fetchDevices}
                disabled={devicesLoading}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'white',
                  border: '1px solid var(--divider)',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: devicesLoading ? 'not-allowed' : 'pointer',
                  opacity: devicesLoading ? 0.5 : 1,
                }}
              >
                {devicesLoading ? 'Loading...' : '↻ Refresh'}
              </button>
            </div>

            {devicesLoading ? (
              <div style={{ textAlign: 'center', padding: 40, opacity: 0.7 }}>
                Loading devices...
              </div>
            ) : devices.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 40,
                  background: 'var(--surface)',
                  borderRadius: 12,
                  border: '1px dashed var(--divider)',
                }}
              >
                <p style={{ fontSize: 16, marginBottom: 8, opacity: 0.7 }}>
                  No devices registered yet
                </p>
                <p style={{ fontSize: 14, opacity: 0.5 }}>
                  Click "Register Device" to add your first device
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  overflowX: 'auto',
                  gap: 16,
                  paddingBottom: 8,
                }}
              >
                {devices.map((device) => {
                  const getAqiColor = (aqi: number) => {
                    if (aqi <= 50) return '#22c55e';
                    if (aqi <= 100) return '#eab308';
                    if (aqi <= 150) return '#f97316';
                    if (aqi <= 200) return '#ef4444';
                    return '#991b1b';
                  };

                  const getAqiLabel = (aqi: number) => {
                    if (aqi <= 50) return 'Good';
                    if (aqi <= 100) return 'Moderate';
                    if (aqi <= 150) return 'Unhealthy for Sensitive';
                    if (aqi <= 200) return 'Unhealthy';
                    return 'Very Unhealthy';
                  };

                  const aqiColor = getAqiColor(device.aqi || 0);
                  const aqiLabel = getAqiLabel(device.aqi || 0);

                  return (
                    <div
                      key={device.id}
                      style={{
                        minWidth: 280,
                        background: 'var(--surface)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid var(--divider)',
                      }}
                    >
                      {/* Device Image */}
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '4/3',
                          background: 'rgba(0, 0, 0, 0.2)',
                          backgroundImage:
                            "url('https://i.imgur.com/g055z5j.png')",
                          backgroundSize: 'contain',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        }}
                      />

                      {/* Device Info */}
                      <div style={{ padding: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                          <p
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            {device.name || 'Unnamed Device'}
                          </p>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: aqiColor,
                            }}
                          >
                            AQI: {device.aqi || 0} - {aqiLabel}
                          </p>
                        </div>

                        {/* Status */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: device.subtitle?.includes('온라인')
                                ? '#22c55e'
                                : '#6b7280',
                              animation: device.subtitle?.includes('온라인')
                                ? 'pulse 2s infinite'
                                : 'none',
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              opacity: 0.8,
                            }}
                          >
                            {device.subtitle || 'Unknown status'}
                          </span>
                        </div>

                        {/* Last Updated */}
                        {device.lastUpdated && (
                          <div
                            style={{
                              marginTop: 12,
                              fontSize: 11,
                              opacity: 0.5,
                            }}
                          >
                            Updated:{' '}
                            {new Date(device.lastUpdated).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
              1. Go to{' '}
              <a
                href="/login"
                style={{ color: '#4f46e5', textDecoration: 'underline' }}
              >
                Login Page
              </a>{' '}
              and sign in
              <br />
              2. Open browser DevTools (F12) → Console tab
              <br />
              3. Run:{' '}
              <code
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                JSON.parse(localStorage.getItem('purecare_auth')).idToken
              </code>
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

              {/* AQI Integration Info */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(79, 70, 229, 0.1)',
                  border: '1px solid rgba(79, 70, 229, 0.3)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  🌍 AQI Integration
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  If you provide your location, we'll automatically:
                  <br />
                  • Find the nearest air quality monitoring station
                  <br />
                  • Detect your timezone (no manual selection needed!)
                  <br />• Cache real-time AQI data for your device
                </div>
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
                  Location (Optional - Enables AQI)
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
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                  Without location, timezone will default to UTC
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
