'use client';

export default function Splash() {
  return (
    <div className="h-dvh w-dvw bg-[#0b0f14] text-white flex flex-col items-center justify-center">
      <div className="flex items-center gap-3 animate-fade-in">
        {/* 심플한 원형 로고 대용 */}
        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 animate-pulse" />
        <span className="text-2xl font-bold tracking-wide">PuriCare</span>
      </div>
      <div className="mt-3 text-white/60 text-sm">breathing made smarter</div>
    </div>
  );
}
