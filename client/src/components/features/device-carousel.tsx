/**
 * Device Carousel Component
 *
 * Horizontal scrollable carousel of air purifier devices
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

interface Device {
  id: string;
  name: string;
  aqi: number;
  aqiLabel: string;
  status: 'online' | 'offline';
  mode: string;
}

interface DeviceCarouselProps {
  devices?: Device[];
}

const MOCK_DEVICES: Device[] = [
  {
    id: 'living',
    name: 'Living Room',
    aqi: 32,
    aqiLabel: 'Good',
    status: 'online',
    mode: 'Auto',
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    aqi: 58,
    aqiLabel: 'Moderate',
    status: 'online',
    mode: 'Auto',
  },
  {
    id: 'office',
    name: 'Office',
    aqi: 25,
    aqiLabel: 'Good',
    status: 'offline',
    mode: 'Off',
  },
];

export default function DeviceCarousel({
  devices = MOCK_DEVICES,
}: DeviceCarouselProps) {
  const router = useRouter();

  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return '#A7C957'; // Good
    if (aqi <= 100) return '#F2CC8F'; // Moderate
    if (aqi <= 150) return '#E76F51'; // Poor
    return '#D90429'; // Unhealthy
  };

  const getAqiBorderColor = (aqi: number) => {
    if (aqi <= 50) return 'rgba(167, 201, 87, 0.8)';
    if (aqi <= 100) return 'rgba(242, 204, 143, 0.8)';
    if (aqi <= 150) return 'rgba(231, 111, 81, 0.8)';
    return 'rgba(217, 4, 41, 0.8)';
  };

  return (
    <div
      style={{
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingTop: 8,
      }}
      className="[-webkit-scrollbar]:hidden"
    >
      <div style={{ display: 'flex', padding: '0 16px', gap: 16 }}>
        {devices.map((device, index) => (
          <div
            key={device.id}
            onClick={() => router.push(`/room/${device.id}`)}
            style={{
              display: 'flex',
              height: '100%',
              flexDirection: 'column',
              gap: 16,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border:
                index === 0
                  ? `2px solid ${getAqiBorderColor(device.aqi)}`
                  : '1px solid rgba(148,163,184,0.2)',
              boxShadow:
                index === 0
                  ? '0 8px 24px rgba(0,0,0,0.3)'
                  : '0 4px 12px rgba(0,0,0,0.2)',
              minWidth: 256,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            className="hover:scale-105"
          >
            {/* Device Image */}
            <div
              style={{
                width: '100%',
                aspectRatio: '4/3',
                backgroundImage: "url('https://i.imgur.com/g055z5j.png')",
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                background: 'rgba(15,23,42,0.4)',
                backgroundBlendMode: 'overlay',
              }}
            />

            {/* Device Info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'space-between',
                padding: 16,
                paddingTop: 0,
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    marginBottom: 4,
                    color: '#fff',
                  }}
                >
                  {device.name}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: getAqiColor(device.aqi),
                  }}
                >
                  AQI: {device.aqi} - {device.aqiLabel}
                </div>
              </div>

              {/* Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background:
                      device.status === 'online' ? '#A7C957' : '#6b7280',
                    animation:
                      device.status === 'online' ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color:
                      device.status === 'online'
                        ? 'rgba(255,255,255,0.9)'
                        : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {device.status === 'online' ? `On - ${device.mode}` : 'Off'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Add Device Card */}
        <div
          onClick={() => router.push('/devices/add')}
          style={{
            display: 'flex',
            minWidth: 256,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            borderRadius: 12,
            border: '2px dashed rgba(148,163,184,0.3)',
            background: 'rgba(99,102,241,0.1)',
            padding: 32,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          className="hover:border-primary hover:bg-primary/20"
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(99,102,241,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: '#818cf8',
            }}
          >
            +
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#818cf8',
              textAlign: 'center',
            }}
          >
            Add Device
          </div>
        </div>
      </div>
    </div>
  );
}
