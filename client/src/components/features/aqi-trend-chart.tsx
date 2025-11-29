/**
 * AQI Trend Chart Component
 *
 * - 실제 디바이스가 있으면: 백엔드에서 센서 데이터 / 알림 불러와서 차트 렌더
 * - 디바이스가 없으면(deviceId 미지정): 프론트에서 만든 목업 데이터로 예시 차트 렌더
 */

'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

import SegmentedControl from '@/components/ui/segmented-control';
import {
  getHistoricalSensorData,
  getDeviceAlerts,
  type SensorReading,
  type Alert,
} from '@/lib/api';

type Timeframe = '24H' | '7D' | '30D';

interface AqiTrendChartProps {
  defaultTimeframe?: Timeframe;
  deviceId?: string; // 없으면 목업 모드
}

// PM2.5 → AQI 변환 (간단 EPA 버전)
function calculateAQIFromPm25(pm25: number): number {
  if (pm25 <= 12) return Math.round((50 / 12) * pm25);
  if (pm25 <= 35.4)
    return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  if (pm25 <= 55.4)
    return Math.round(
      ((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101,
    );
  if (pm25 <= 150.4)
    return Math.round(
      ((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151,
    );
  if (pm25 <= 250.4)
    return Math.round(
      ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201,
    );
  return Math.round(
    ((500 - 301) / (500.4 - 250.5)) * (pm25 - 250.5) + 301,
  );
}

// SVG 라인 경로
function generateChartPath(dataPoints: { x: number; y: number }[]): string {
  if (dataPoints.length === 0) return '';

  let path = `M${dataPoints[0].x} ${dataPoints[0].y}`;
  for (let i = 1; i < dataPoints.length; i++) {
    path += ` L${dataPoints[i].x} ${dataPoints[i].y}`;
  }
  return path;
}

// SVG 채우기 영역
function generateFillPath(
  dataPoints: { x: number; y: number }[],
  height: number,
): string {
  if (dataPoints.length === 0) return '';

  let path = `M${dataPoints[0].x} ${dataPoints[0].y}`;
  for (let i = 1; i < dataPoints.length; i++) {
    path += ` L${dataPoints[i].x} ${dataPoints[i].y}`;
  }
  path += ` L${dataPoints[dataPoints.length - 1].x} ${height}`;
  path += ` L${dataPoints[0].x} ${height}`;
  path += ' Z';
  return path;
}

/** ▸ 디바이스 없을 때 사용하는 목업 센서 데이터 (완전 결정적, random 없음) */
function generateMockSensorData(timeframe: Timeframe): SensorReading[] {
  const result: SensorReading[] = [];

  const count = timeframe === '24H' ? 24 : timeframe === '7D' ? 7 : 30;

  const base = timeframe === '24H' ? 20 : timeframe === '7D' ? 22 : 25;
  const amplitude = timeframe === '24H' ? 10 : timeframe === '7D' ? 12 : 15;

  for (let i = 0; i < count; i++) {
    // 인덱스 기반으로만 만드는 부드러운 패턴
    const wave = Math.sin((i / count) * Math.PI * 2) * amplitude;
    const pm25 = base + wave;

    // 시간은 그냥 고정 기준에서 + i (데이트 차이는 UI에 안 보임)
    const t = new Date('2025-01-01T00:00:00.000Z');
    t.setHours(t.getHours() + i);

    result.push({
      time: t.toISOString(),
      rh: 45, // 고정값 (렌더에 직접 안 쓰임)
      co: 0,
      co2: 600,
      no2: 0,
      pm10: pm25 + 5,
      pm25,
      temp: 23,
      tvoc: 0.35,
    });
  }

  return result;
}

/** ▸ 디바이스 없을 때 사용하는 목업 Alert 데이터 (random/now 없음) */
function generateMockAlerts(timeframe: Timeframe): Alert[] {
  const count = timeframe === '24H' ? 3 : timeframe === '7D' ? 5 : 7;
  const severities: Alert['severity'][] = [
    'low',
    'medium',
    'high',
    'critical',
  ];

  const baseTime = new Date('2025-01-07T12:00:00.000Z');

  const result: Alert[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(baseTime);
    t.setHours(baseTime.getHours() - (i + 1) * 3);

    const severity = severities[i % severities.length];

    result.push({
      id: `mock-${timeframe}-${i}`,
      type: 'pm25-spike',
      severity,
      message:
        severity === 'critical'
          ? 'Severe PM2.5 spike detected'
          : severity === 'high'
          ? 'High PM2.5 level detected'
          : 'Moderate PM2.5 increase detected',
      sensorValue: 35 + i * 5,
      timestamp: t.toISOString(),
      acknowledged: false,
    });
  }

  return result;
}

export default function AqiTrendChart({
  defaultTimeframe = '7D',
  deviceId,
}: AqiTrendChartProps) {
  const [timeframe, setTimeframe] =
    useState<Timeframe>(defaultTimeframe);

  const isMockMode = !deviceId;

  // 기간 계산
  const timeRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    switch (timeframe) {
      case '24H':
        start.setHours(now.getHours() - 24);
        break;
      case '7D':
        start.setDate(now.getDate() - 7);
        break;
      case '30D':
        start.setDate(now.getDate() - 30);
        break;
    }

    return { startTime: start, endTime: now };
  }, [timeframe]);

  // ──────────────── 센서 데이터 / 알림 가져오기 ────────────────

  const {
    data: sensorData,
    isLoading,
  } = useSWR<SensorReading[]>(
    !isMockMode && deviceId
      ? ['historical-sensor', deviceId, timeframe]
      : null,
    () =>
      getHistoricalSensorData(deviceId!, {
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        limit:
          timeframe === '24H'
            ? 288
            : timeframe === '7D'
            ? 168
            : 300,
      }),
    {
      refreshInterval: 60_000,
    },
  );

  const { data: alerts } = useSWR<Alert[]>(
    !isMockMode && deviceId
      ? ['device-alerts', deviceId, timeframe]
      : null,
    () => getDeviceAlerts(deviceId!, 20, false),
    {
      refreshInterval: 30_000,
    },
  );

  // 실제 / 목업 센서 데이터 선택
  const effectiveSensorData = useMemo<SensorReading[]>(() => {
    if (isMockMode) return generateMockSensorData(timeframe);
    return sensorData ?? [];
  }, [isMockMode, sensorData, timeframe]);

  // 실제 / 목업 알림 데이터 선택
  const effectiveAlerts = useMemo<Alert[]>(() => {
    if (isMockMode) return generateMockAlerts(timeframe);
    return alerts ?? [];
  }, [isMockMode, alerts, timeframe]);

  // ──────────────── 차트용 데이터 계산 ────────────────

  const chartData = useMemo(() => {
    if (!effectiveSensorData || effectiveSensorData.length === 0) {
      return {
        dataPoints: [] as { x: number; y: number }[],
        currentAqi: 0,
        changePercent: 0,
        labels: [] as string[],
      };
    }

    const aqiReadings = effectiveSensorData.map((reading) => ({
      time: new Date(reading.time),
      aqi: calculateAQIFromPm25(reading.pm25),
    }));

    aqiReadings.sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

    const maxAqi = Math.max(...aqiReadings.map((r) => r.aqi), 100);
    const minAqi = Math.min(...aqiReadings.map((r) => r.aqi), 0);
    const range = maxAqi - minAqi || 1;

    const dataPoints = aqiReadings.map(
      (reading, index): { x: number; y: number } => ({
        x: (index / (aqiReadings.length - 1 || 1)) * 475,
        y:
          150 -
          ((reading.aqi - minAqi) / range) * 120, // 0~120 높이로 스케일링
      }),
    );

    const currentAqi =
      aqiReadings[aqiReadings.length - 1]?.aqi ?? 0;
    const previousAqi =
      aqiReadings[0]?.aqi ?? currentAqi;
    const changePercent =
      previousAqi !== 0
        ? Math.round(
            ((currentAqi - previousAqi) / previousAqi) * 100,
          )
        : 0;

    let labels: string[] = [];
    if (timeframe === '24H') {
      labels = [
        '00:00',
        '04:00',
        '08:00',
        '12:00',
        '16:00',
        '20:00',
        '24:00',
      ];
    } else if (timeframe === '7D') {
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else {
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    }

    return { dataPoints, currentAqi, changePercent, labels };
  }, [effectiveSensorData, timeframe]);

  const {
    dataPoints,
    currentAqi,
    changePercent,
    labels,
  } = chartData;

  const isImproving = changePercent < 0;

  const recentAlertCount = useMemo(() => {
    if (!effectiveAlerts || effectiveAlerts.length === 0)
      return 0;

    // ▸ mock 모드에서는 시간 필터 없이 개수만 사용 (항상 동일)
    if (isMockMode) return effectiveAlerts.length;

    const rangeStart = timeRange.startTime.getTime();
    return effectiveAlerts.filter((alert) => {
      const alertTime = new Date(alert.timestamp).getTime();
      return alertTime >= rangeStart;
    }).length;
  }, [effectiveAlerts, timeRange, isMockMode]);

  // ──────────────── 로딩 UI (실제 모드일 때만) ────────────────
  if (!isMockMode && isLoading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          opacity: 0.7,
        }}
      >
        Loading chart data...
      </div>
    );
  }

  // ──────────────── 센서 데이터가 아예 없을 때 ────────────────
  if (!effectiveSensorData || effectiveSensorData.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          opacity: 0.7,
          background: 'rgba(15,23,42,0.6)',
          borderRadius: 16,
          border: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        <div style={{ fontSize: 16, marginBottom: 8 }}>
          No data available
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Waiting for sensor readings from your device
        </div>
      </div>
    );
  }

  // ──────────────── 실제 렌더 ────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 16,
      }}
    >
      {/* 상단 시간 범위 선택 토글 */}
      <SegmentedControl
        options={[
          { value: '24H', label: '24H' },
          { value: '7D', label: '7D' },
          { value: '30D', label: '30D' },
        ]}
        value={timeframe}
        onChange={(value) => setTimeframe(value as Timeframe)}
      />

      {/* AQI Trend 카드 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderRadius: 16,
          background: 'rgba(15,23,42,0.6)',
          padding: 16,
          border: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          AQI Trend
          {isMockMode && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                marginLeft: 6,
                color: 'rgba(248,250,252,0.6)',
              }}
            >
              (Demo data)
            </span>
          )}
        </div>

        {/* 요약 수치 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {currentAqi}{' '}
            <span style={{ fontSize: 20 }}>AQI</span>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: isImproving ? '#A7C957' : '#E76F51',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 18 }}>
              {isImproving ? '↓' : '↑'}
            </span>
            <span>{Math.abs(changePercent)}%</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          vs Last{' '}
          {timeframe === '24H'
            ? '24 Hours'
            : timeframe === '7D'
            ? '7 Days'
            : '30 Days'}
        </div>

        {/* 라인 차트 */}
        <div style={{ minHeight: 160, paddingTop: 16 }}>
          {dataPoints.length > 0 ? (
            <svg
              width="100%"
              height="150"
              viewBox="0 0 475 150"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <path
                d={generateFillPath(dataPoints, 150)}
                fill="url(#chart-gradient)"
              />
              <path
                d={generateChartPath(dataPoints)}
                stroke="#13a4ec"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <defs>
                <linearGradient
                  id="chart-gradient"
                  x1="236"
                  y1="1"
                  x2="236"
                  y2="149"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop
                    stopColor="#13a4ec"
                    stopOpacity="0.2"
                  />
                  <stop
                    offset="1"
                    stopColor="#13a4ec"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
            </svg>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: 20,
                opacity: 0.5,
              }}
            >
              No chart data available
            </div>
          )}
        </div>

        {/* 아래 축 라벨 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            paddingTop: 8,
          }}
        >
          {labels.map((label, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts 카드 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderRadius: 16,
          background: 'rgba(15,23,42,0.6)',
          padding: 16,
          border: '1px solid rgba(148,163,184,0.2)',
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          Recent Alerts
          {isMockMode && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                marginLeft: 6,
                color: 'rgba(248,250,252,0.6)',
              }}
            >
              (Demo data)
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {recentAlertCount}{' '}
            <span style={{ fontSize: 20 }}>Alerts</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          in Last{' '}
          {timeframe === '24H'
            ? '24 Hours'
            : timeframe === '7D'
            ? '7 Days'
            : '30 Days'}
        </div>

        {/* 간단 점 그래프 (알림 분포) */}
        {effectiveAlerts && effectiveAlerts.length > 0 ? (
          <div
            style={{
              position: 'relative',
              height: 128,
              width: '100%',
              paddingTop: 32,
              paddingBottom: 16,
            }}
          >
            {/* 가이드 라인 */}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: 0,
                right: 0,
                borderTop:
                  '1px dashed rgba(148,163,184,0.3)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 88,
                left: 0,
                right: 0,
                borderTop:
                  '1px dashed rgba(148,163,184,0.3)',
              }}
            />

            {/* Alert 점 10개까지만 표시 (index 기반 고정 위치) */}
            {effectiveAlerts.slice(0, 10).map(
              (alert: Alert, index: number) => {
                const severityColor =
                  alert.severity === 'critical'
                    ? '#D90429'
                    : alert.severity === 'high'
                    ? '#E76F51'
                    : alert.severity === 'medium'
                    ? '#F2CC8F'
                    : '#A7C957';

                const bottomPercent =
                  25 + (index % 4) * 15; // 25, 40, 55, 70 순환
                const leftPercent =
                  5 + (index / 10) * 90; // 5% ~ 95%

                return (
                  <div
                    key={alert.id}
                    style={{
                      position: 'absolute',
                      left: `${leftPercent}%`,
                      bottom: `${bottomPercent}%`,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: severityColor,
                      boxShadow: `0 0 0 4px ${severityColor}30`,
                      zIndex: 10,
                    }}
                  />
                );
              },
            )}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: 20,
              opacity: 0.5,
              fontSize: 13,
            }}
          >
            No alerts in this time period
          </div>
        )}
      </div>
    </div>
  );
}
