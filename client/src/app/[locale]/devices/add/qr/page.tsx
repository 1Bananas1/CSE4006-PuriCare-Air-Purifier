// app/devices/add/qr/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function AddDeviceQrPage() {
  const t = useTranslations('DevicesAddQrPage');
  const c = useTranslations('Common'); // 필요하면 공통 문구용
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);

  const hasSnapshot = !!snapshotDataUrl;

  // 카메라 시작
  const startCamera = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setCameraError(null);

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(t('cameraUnsupported'));
      }

      // 기존 스트림 정리
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (err: any) {
          // play() 도중 스트림이 바뀌면 나는 AbortError는 무시
          if (err?.name !== 'AbortError') {
            throw err;
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setCameraError(
        t('cameraErrorFallback'),
      );
    } finally {
      setIsStarting(false);
    }
  };

  // 마운트 시 카메라 시작, 언마운트 시 정리
  useEffect(() => {
    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 현재 프레임 캡처해서 사진 찍기
  const handleTakeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');
    setSnapshotDataUrl(dataUrl);

    // 사진 찍었으면 스트림 정리해서 화면 고정
    if (video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  };

  // 다시 찍기
  const handleRetake = () => {
    setSnapshotDataUrl(null);
    startCamera();
  };

  // 이 사진으로 계속 진행 → QR 확인 페이지로 이동
  const handleProceed = () => {
    router.push('/devices/add/qr/confirm');
  };

  const handleGoSerial = () => {
    router.push('/devices/add/serial');
  };

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 상단 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          padding: '12px 16px 8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label={t('back')}
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{t('qrTitle')}</div>
      </div>

      {/* 카메라 / 사진 프리뷰 영역 */}
      <section
        className="mobile-wrap"
        style={{
          flex: 1,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 18,
            overflow: 'hidden',
            background: '#000',
            position: 'relative',
          }}
        >
          {!hasSnapshot ? (
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <img
              src={snapshotDataUrl!}
              alt={t('snapshotAlt')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}

          {/* 캡처용 캔버스 (숨김) */}
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          {/* QR 가이드 프레임 */}
          <div
            style={{
              position: 'absolute',
              inset: '15%',
              borderRadius: 24,
              border: '3px solid rgba(248,250,252,0.9)',
              boxShadow: '0 0 0 999px rgba(15,23,42,0.45)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* 안내 / 에러 메시지 */}
        {cameraError ? (
          <div
            style={{
              fontSize: 12,
              color: '#f97316',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚠️</span>
            <span>{cameraError}</span>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            {t('cameraHint')}
          </div>
        )}

        {/* 하단 버튼 */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={hasSnapshot ? handleRetake : startCamera}
            disabled={isStarting}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.6)',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {hasSnapshot
              ? t('retake')
              : isStarting
              ? t('startingCamera')
              : t('retryCamera')}
          </button>

          <button
            type="button"
            onClick={hasSnapshot ? handleProceed : handleTakeSnapshot}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 999,
              border: 'none',
              background:
                'linear-gradient(135deg, #22c55e, #16a34a, #0f766e)',
              color: '#0b1120',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {hasSnapshot ? t('proceedWithPhoto') : t('proceedNext')}
          </button>
        </div>

        {/* 시리얼 번호로 이동 링크 */}
        <button
          type="button"
          onClick={handleGoSerial}
          style={{
            marginTop: 6,
            alignSelf: 'center',
            fontSize: 12,
            opacity: 0.8,
            textDecoration: 'underline',
          }}
        >
          {t('goSerial')}
        </button>
      </section>
    </main>
  );
}