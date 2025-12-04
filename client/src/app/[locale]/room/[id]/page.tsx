// app/room/[id]/page.tsx
'use client';
import {
  getDeviceStatus,
  togglePower,
  toggleAutoMode,
  setFanSpeed,
} from '@/lib/api';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
// import { useTranslations } from 'next-intl'; // TODO: Uncomment when adding i18n
import { useState } from 'react';
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

  // TODO: Replace with actual API call to fetch device status
  // useEffect(() => {
  //   const fetchStatus = async () => {
  //     const deviceStatus = await getDeviceStatus(deviceId);
  //     setStatus(deviceStatus);
  //   };
  //   fetchStatus();
  //   const interval = setInterval(fetchStatus, 5000);
  //   return () => clearInterval(interval);
  // }, [deviceId]);

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
        <button
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
    </main>
  );
}