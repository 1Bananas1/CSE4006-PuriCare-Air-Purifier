'use client';
import { useEffect, useState } from 'react';

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem('purecare_welcome_at') || '0');
      const nm = localStorage.getItem('purecare_welcome_name') || '';
      if (at && Date.now() - at < 30_000) { setName(nm); setOpen(true); }
      localStorage.removeItem('purecare_welcome_at');
      localStorage.removeItem('purecare_welcome_name');
    } catch {}
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
      display:'grid', placeItems:'center', zIndex:50, padding:16
    }}>
      <div className="mobile-wrap" style={{ padding: 0 }}>
        <div
          style={{
            width:'100%', background:'#121923', borderRadius:16, padding:18,
            boxShadow:'0 10px 30px rgba(0,0,0,.45)'
          }}
        >
          <div style={{ fontSize:18, fontWeight:800, marginBottom:6 }}>
            어서 오세요{ name ? `, ${name} 님!` : '!' } 👋
          </div>
          <div style={{ fontSize:14, opacity:.8 }}>
            PuriCare가 더 안전한 호흡 환경을 준비 중이에요.
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              marginTop:12, width:'100%', padding:'12px',
              borderRadius:12, background:'rgba(255,255,255,.12)', fontSize:15
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

