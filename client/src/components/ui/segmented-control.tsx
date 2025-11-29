/**
 * SegmentedControl Component
 *
 * iOS-style segmented control for radio button groups
 * Used for mode selection, time ranges, and other mutually exclusive options
 */

'use client';

interface Option {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: SegmentedControlProps) {
  const heights = {
    sm: 36,
    md: 48,
    lg: 56,
  };

  const fontSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        height: heights[size],
        borderRadius: 12,
        background: 'rgba(148,163,184,0.1)',
        padding: 6,
        gap: 4,
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={{
            flex: 1,
            borderRadius: 8,
            border: 'none',
            background:
              value === option.value
                ? 'rgba(99,102,241,0.25)'
                : 'transparent',
            color:
              value === option.value ? '#818cf8' : 'rgba(255,255,255,0.7)',
            fontSize: fontSizes[size],
            fontWeight: value === option.value ? 700 : 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}