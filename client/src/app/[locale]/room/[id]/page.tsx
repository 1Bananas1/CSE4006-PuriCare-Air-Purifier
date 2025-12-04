// app/room/[id]/page.tsx
'use client';
import {
  getDeviceStatus,
  togglePower,
  toggleAutoMode,
  setFanSpeed,
  deleteDevice,
} from '@/lib/api';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
// import { useTranslations } from 'next-intl'; // TODO: Uncomment when adding i18n
import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';

// Timer type
type TimerValue = 'OFF' | '4hr' | '6hr' | '8hr';

// Local UI state for features not yet in backend
interface LocalState {
  timer: TimerValue;
  childLock: boolean;
}

export default function RoomPage() {
  // TODO: Uncomment when adding i18n support
  // const t = useTranslations('RoomPage');

  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deviceId = (params?.id as string) ?? 'living';

  // Local state for timer and child lock (not in backend yet)
  const [localState, setLocalState] = useState<LocalState>({
    timer: 'OFF',
    childLock: false,
  });

  // Menu and dialog state
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Fetch device status from backend with SWR
  const {
    data: deviceStatus,
    error,
    mutate,
    isLoading,
  } = useSWR(
    deviceId ? ['device-status', deviceId] : null,
    () => getDeviceStatus(deviceId),
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: true,
    }
  );

  // Combine backend status with local state
  const status = deviceStatus
    ? {
        online: deviceStatus.online,
        fanSpeed: deviceStatus.fanSpeed,
        autoMode: deviceStatus.autoMode,
        timer: localState.timer,
        childLock: localState.childLock,
      }
    : null;

  // Handle power toggle with optimistic update
  const handlePowerToggle = async (checked: boolean) => {
    if (!deviceStatus) return;

    // Optimistic update
    mutate({ ...deviceStatus, online: checked }, false);

    try {
      await togglePower(deviceId, checked);
      // Revalidate to sync with backend
      mutate();
    } catch (err) {
      console.error('Failed to toggle power:', err);
      // Revert on error
      mutate();
      alert('Failed to toggle power. Please try again.');
    }
  };

  // Handle mode toggle with optimistic update
  const handleModeChange = async (mode: 'Manual' | 'Auto') => {
    if (!deviceStatus) return;

    const enabled = mode === 'Auto';

    // Optimistic update
    mutate({ ...deviceStatus, autoMode: enabled }, false);

    try {
      await toggleAutoMode(deviceId, enabled);
      // Revalidate to sync with backend
      mutate();
    } catch (err) {
      console.error('Failed to change mode:', err);
      // Revert on error
      mutate();
      alert('Failed to change mode. Please try again.');
    }
  };

  // Handle fan speed change with optimistic update
  const handleFanSpeedChange = async (speed: number) => {
    if (!deviceStatus || deviceStatus.autoMode) return; // Don't allow manual change in auto mode

    // Optimistic update
    mutate({ ...deviceStatus, fanSpeed: speed }, false);

    try {
      await setFanSpeed(deviceId, speed);
      // Revalidate to sync with backend
      mutate();
    } catch (err) {
      console.error('Failed to change fan speed:', err);
      // Revert on error
      mutate();
      alert('Failed to change fan speed. Please try again.');
    }
  };

  // Handle timer change (local state only - no backend yet)
  const handleTimerChange = (timer: TimerValue) => {
    setLocalState((prev) => ({ ...prev, timer }));

    // TODO: Call backend API to set timer when available
    // await setTimer(deviceId, timer);
  };

  // Handle child lock toggle (local state only - no backend yet)
  const handleChildLockToggle = (checked: boolean) => {
    setLocalState((prev) => ({ ...prev, childLock: checked }));

    // TODO: Call backend API to toggle child lock when available
    // await setChildLock(deviceId, checked);
  };

  // Handle view sensor data
  const handleViewSensorData = () => {
    // TODO: Navigate to sensor data page or show modal
    alert('View sensor data - To be implemented');
  };

  // Handle delete device
  const handleDeleteDevice = async () => {
    try {
      await deleteDevice(deviceId);
      setShowDeleteConfirm(false);
      setShowMenu(false);
      // Navigate back to home/devices list after deletion
      router.push('/');
    } catch (err) {
      console.error('Failed to delete device:', err);
      alert('Failed to delete device. Please try again.');
      setShowDeleteConfirm(false);
    }
  };

  // Loading state
  if (isLoading || !status) {
    return (
      <main
        className="pb-safe"
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 16 }}>Loading device status...</div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main
        className="pb-safe"
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--text)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 16, color: '#D0021B', textAlign: 'center' }}>
          Failed to load device status
        </div>
        <button
          onClick={() => mutate()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: '#4A90E2',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--divider)',
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </main>
    );
  }

  const currentMode = status.autoMode ? 'Auto' : 'Manual';
  const fanSpeedPercent = Math.round((status.fanSpeed / 10) * 100);

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* Top App Bar */}
      <div
        className="mobile-wrap"
        style={{
          padding: '12px 16px 8px 16px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 24,
          }}
        >
          ←
        </button>
        <h1
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          Living Room Purifier
        </h1>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 24,
            }}
          >
            ⋮
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--surface)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                minWidth: 180,
                border: '1px solid rgba(148, 163, 184, 0.2)',
                zIndex: 1000,
              }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowDeleteConfirm(true);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: '#D0021B',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 8,
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(208, 2, 27, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Delete Device
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body Content */}
      <section
        className="mobile-wrap"
        style={{
          padding: '0 16px 32px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Status Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status.online ? '#50E3C2' : '#AEB5C0',
            }}
          />
          <p
            style={{
              fontSize: 14,
              color: status.online ? '#50E3C2' : '#AEB5C0',
            }}
          >
            {status.online ? 'Connected' : 'Disconnected'}
          </p>
        </div>

        {/* Power Control Card */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid rgba(148, 163, 184, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(74, 144, 226, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4A90E2',
                fontSize: 24,
              }}
            >
              ⏻
            </div>
            <p style={{ fontSize: 18, fontWeight: 'bold' }}>Power</p>
          </div>
          <label
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: 51,
              height: 31,
              borderRadius: 9999,
              background: status.online
                ? '#4A90E2'
                : 'rgba(174, 181, 192, 0.5)',
              cursor: 'pointer',
              padding: 2,
              justifyContent: status.online ? 'flex-end' : 'flex-start',
              transition: 'all 0.3s ease',
            }}
          >
            <div
              style={{
                width: 27,
                height: 27,
                borderRadius: '50%',
                background: 'white',
                boxShadow:
                  'rgba(0, 0, 0, 0.15) 0px 3px 8px, rgba(0, 0, 0, 0.06) 0px 3px 1px',
              }}
            />
            <input
              type="checkbox"
              checked={status.online}
              onChange={(e) => handlePowerToggle(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
          </label>
        </div>

        {/* Mode Section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            Mode
          </h2>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 8,
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div
              style={{
                height: 48,
                background: 'rgba(174, 181, 192, 0.1)',
                borderRadius: 8,
                padding: 4,
                display: 'flex',
                gap: 4,
              }}
            >
              {(['Manual', 'Auto'] as const).map((mode) => (
                <label
                  key={mode}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    background:
                      currentMode === mode ? 'var(--surface)' : 'transparent',
                    color: currentMode === mode ? 'var(--text)' : '#AEB5C0',
                    fontWeight: 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {mode}
                  <input
                    type="radio"
                    name="mode-selection"
                    value={mode}
                    checked={currentMode === mode}
                    onChange={() => handleModeChange(mode)}
                    style={{ display: 'none' }}
                  />
                </label>
              ))}
            </div>
          </div>
          <p
            style={{
              fontSize: 14,
              color: '#AEB5C0',
              marginTop: 12,
              paddingLeft: 8,
            }}
          >
            Next sensor reading in: 12 minutes.
          </p>
        </div>

        {/* Fan Speed Section */}
        <div
          style={{
            opacity: status.autoMode ? 0.5 : 1,
            pointerEvents: status.autoMode ? 'none' : 'auto',
            transition: 'opacity 0.3s ease',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            Fan Speed
          </h2>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 16,
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 500, color: '#AEB5C0' }}>
                {status.autoMode ? 'Auto Mode Active' : 'Manual Control'}
              </p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#4A90E2' }}>
                {fanSpeedPercent}%
              </p>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 8,
                borderRadius: 9999,
                background: 'rgba(174, 181, 192, 0.2)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  height: '100%',
                  borderRadius: 9999,
                  background: '#4A90E2',
                  width: `${fanSpeedPercent}%`,
                  transition: 'width 0.3s ease',
                }}
              />
              <input
                type="range"
                min="0"
                max="10"
                value={status.fanSpeed}
                onChange={(e) => handleFanSpeedChange(parseInt(e.target.value))}
                disabled={status.autoMode}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: status.autoMode ? 'not-allowed' : 'pointer',
                }}
              />
            </div>
          </div>
        </div>

        {/* Timer Section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            Set Timer
          </h2>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 8,
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div
              style={{
                height: 48,
                background: 'rgba(174, 181, 192, 0.1)',
                borderRadius: 8,
                padding: 4,
                display: 'flex',
                gap: 4,
              }}
            >
              {(['OFF', '4hr', '6hr', '8hr'] as const).map((timer) => (
                <label
                  key={timer}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    background:
                      status.timer === timer ? 'var(--surface)' : 'transparent',
                    color: status.timer === timer ? 'var(--text)' : '#AEB5C0',
                    fontWeight: 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {timer}
                  <input
                    type="radio"
                    name="timer-selection"
                    value={timer}
                    checked={status.timer === timer}
                    onChange={() => handleTimerChange(timer)}
                    style={{ display: 'none' }}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Utilities Section */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            Utilities
          </h2>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            {/* Child Lock */}
            <div
              style={{
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'rgba(174, 181, 192, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  🔒
                </div>
                <p style={{ fontSize: 16 }}>Child Lock</p>
              </div>
              <label
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: 51,
                  height: 31,
                  borderRadius: 9999,
                  background: status.childLock
                    ? '#4A90E2'
                    : 'rgba(174, 181, 192, 0.2)',
                  cursor: 'pointer',
                  padding: 2,
                  justifyContent: status.childLock ? 'flex-end' : 'flex-start',
                  transition: 'all 0.3s ease',
                }}
              >
                <div
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow:
                      'rgba(0, 0, 0, 0.15) 0px 3px 8px, rgba(0, 0, 0, 0.06) 0px 3px 1px',
                  }}
                />
                <input
                  type="checkbox"
                  checked={status.childLock}
                  onChange={(e) => handleChildLockToggle(e.target.checked)}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                />
              </label>
            </div>

            {/* Separator */}
            <div
              style={{ height: 1, background: 'rgba(174, 181, 192, 0.2)' }}
            />

            {/* Sensor History */}
            <button
              onClick={handleViewSensorData}
              style={{
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'background 0.2s ease',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(174, 181, 192, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'rgba(174, 181, 192, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  📊
                </div>
                <p style={{ fontSize: 16 }}>View Sensor Data</p>
              </div>
              <div style={{ fontSize: 20, color: '#AEB5C0' }}>›</div>
            </button>
          </div>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="mobile-wrap"
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                marginBottom: 12,
                color: 'var(--text)',
              }}
            >
              Delete Device?
            </h2>
            <p
              style={{
                fontSize: 14,
                color: '#AEB5C0',
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to delete this device? This action cannot be
              undone and will remove all associated data.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--divider)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDevice}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: '#D0021B',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
