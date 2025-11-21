// lib/weather.ts
export function weatherEmoji(main?: string, icon?: string) {
  if (!main) return '🌤️';
  const m = main.toLowerCase();

  if (m.includes('thunder')) return '⛈️';
  if (m.includes('drizzle') || m.includes('rain')) return '🌧️';
  if (m.includes('snow')) return '❄️';
  if (m.includes('mist') || m.includes('fog') || m.includes('haze') || m.includes('smoke')) return '🌫️';
  if (m.includes('clear')) return icon?.endsWith('n') ? '🌙' : '☀️';
  if (m.includes('cloud')) return '☁️';
  return '🌤️';
}
