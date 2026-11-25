import { useState } from 'react';
import { getContrastTextColor } from '../../shared/config.ts';

interface BrandMarkProps {
  logoUrl: string | null;
  businessName: string;
  primaryColor: string;
  ctaColor: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandMark({
  logoUrl,
  businessName,
  primaryColor,
  ctaColor,
  size = 'lg',
}: BrandMarkProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const dimensions =
    size === 'sm'
      ? 'h-10 w-10 rounded-xl'
      : size === 'md'
        ? 'h-14 w-14 rounded-2xl'
        : 'h-16 w-16 rounded-2xl';

  const iconSize = size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-7 w-7' : 'h-8 w-8';

  if (logoUrl && !imgFailed) {
    return (
      <div
        className={`${dimensions} overflow-hidden border border-slate-200/80 bg-white flex items-center justify-center shrink-0 shadow-xs`}
      >
        <img
          src={logoUrl}
          alt={`${businessName} logo`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain p-1.5"
        />
      </div>
    );
  }

  const initials = businessName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'QR';

  const textColor = getContrastTextColor(primaryColor);

  return (
    <div
      className={`${dimensions} flex items-center justify-center shrink-0 shadow-xs relative overflow-hidden`}
      style={{ backgroundColor: primaryColor, color: textColor }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        className={`${iconSize} opacity-95`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="5"
          y="5"
          width="38"
          height="38"
          rx="10"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <path
          d="M24 12.5L27.1 18.8L34 19.8L29 24.7L30.2 31.5L24 28.2L17.8 31.5L19 24.7L14 19.8L20.9 18.8L24 12.5Z"
          fill={ctaColor}
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">{initials}</span>
    </div>
  );
}
