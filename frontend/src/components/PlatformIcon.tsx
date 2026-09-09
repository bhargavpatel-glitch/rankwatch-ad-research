import React from 'react';
import { Globe } from 'lucide-react';

interface PlatformIconProps {
  platform: string;
  className?: string;
  showTooltip?: boolean;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  className = 'w-4 h-4',
  showTooltip = true,
}) => {
  const p = (platform || '').toLowerCase().trim();

  // 1. Google Ads / Google
  if (p.includes('google')) {
    return (
      <svg
        viewBox="0 0 205 195"
        className={className}
        aria-label={platform || 'Google Ads'}
      >
        {showTooltip && <title>{platform || 'Google Ads'}</title>}
        <g transform="translate(-10, -5)">
          {/* Blue diagonal shape */}
          <path
            d="M85.9 28.6c2.4-6.3 5.7-12.1 10.6-16.8 19.6-19.1 52-14.3 65.3 9.7 10 18.2 20.6 36 30.9 54l51.6 89.8c14.3 25.1-1.2 56.8-29.6 61.1-17.4 2.6-33.7-5.4-42.7-21l-45.4-78.8c-.3-.6-.7-1.1-1.1-1.6-1.6-1.3-2.3-3.2-3.3-4.9L88.8 62.2c-3.9-6.8-5.7-14.2-5.5-22 .3-4 .8-8 2.6-11.6"
            fill="#3c8bd9"
          />
          {/* Yellow diagonal bar */}
          <path
            d="M85.9 28.6c-.9 3.6-1.7 7.2-1.9 11-.3 8.4 1.8 16.2 6 23.5l32.9 56.9c1 1.7 1.8 3.4 2.8 5l-18.1 31.1-25.3 43.6c-.4 0-.5-.2-.6-.5-.1-.8.2-1.5.4-2.3 4.1-15 .7-28.3-9.6-39.7-6.3-6.9-14.3-10.8-23.5-12.1-12-1.7-22.6 1.4-32.1 8.9-1.7 1.3-2.8 3.2-4.8 4.2-.4 0-.6-.2-.7-.5l14.3-24.9L85.2 29.7c.2-.4.5-.7.7-1.1"
            fill="#fabc04"
          />
          {/* Green circular dot */}
          <path
            d="M11.8 158l5.7-5.1c24.3-19.2 60.8-5.3 66.1 25.1 1.3 7.3.6 14.3-1.6 21.3-.1.6-.2 1.1-.4 1.7-.9 1.6-1.7 3.3-2.7 4.9-8.9 14.7-22 22-39.2 20.9C20 225.4 4.5 210.6 1.8 191c-1.3-9.5.6-18.4 5.5-26.6 1-1.8 2.2-3.4 3.3-5.2.5-.4.3-1.2 1.2-1.2"
            fill="#34a852"
          />
        </g>
      </svg>
    );
  }

  // 2. Meta Ads / Meta / Facebook
  if (p.includes('meta') || p.includes('facebook')) {
    return (
      <svg
        viewBox="0 0 16 16"
        className={className}
        fill="#0081FB"
        aria-label={platform || 'Meta Ads'}
      >
        {showTooltip && <title>{platform || 'Meta Ads'}</title>}
        <path
          fillRule="evenodd"
          d="M8.217 5.243C9.145 3.988 10.171 3 11.483 3 13.96 3 16 6.153 16.001 9.907c0 2.29-.986 3.725-2.757 3.725-1.543 0-2.395-.866-3.924-3.424l-.667-1.123-.118-.197a55 55 0 0 0-.53-.877l-1.178 2.08c-1.673 2.925-2.615 3.541-3.923 3.541C1.086 13.632 0 12.217 0 9.973 0 6.388 1.995 3 4.598 3q.477-.001.924.122c.31.086.611.22.913.407.577.359 1.154.915 1.782 1.714m1.516 2.224q-.378-.615-.727-1.133L9 6.326c.845-1.305 1.543-1.954 2.372-1.954 1.723 0 3.102 2.537 3.102 5.653 0 1.188-.39 1.877-1.195 1.877-.773 0-1.142-.51-2.61-2.87zM4.846 4.756c.725.1 1.385.634 2.34 2.001A212 212 0 0 0 5.551 9.3c-1.357 2.126-1.826 2.603-2.581 2.603-.777 0-1.24-.682-1.24-1.9 0-2.602 1.298-5.264 2.846-5.264q.137 0 .27.018"
        />
      </svg>
    );
  }

  // 3. Instagram
  if (p.includes('insta')) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        aria-label={platform || 'Instagram'}
      >
        {showTooltip && <title>{platform || 'Instagram'}</title>}
        <defs>
          <linearGradient id="igPlatformGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f09433" />
            <stop offset="25%" stopColor="#e6683c" />
            <stop offset="50%" stopColor="#dc2743" />
            <stop offset="75%" stopColor="#cc2366" />
            <stop offset="100%" stopColor="#bc1888" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#igPlatformGradient)" />
        <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="15.8" cy="8.2" r="0.9" fill="#fff" />
      </svg>
    );
  }

  // 4. LinkedIn
  if (p.includes('link')) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        aria-label={platform || 'LinkedIn'}
      >
        {showTooltip && <title>{platform || 'LinkedIn'}</title>}
        <rect width="24" height="24" rx="4.5" fill="#0A66C2" />
        <path
          fill="#fff"
          d="M6 9.5h2.5V18H6V9.5zM7.25 6a1.45 1.45 0 100 2.9 1.45 1.45 0 000-2.9zM11 9.5h2.4v1.2h.03c.33-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.83V18h-2.5v-4.1c0-.98-.02-2.24-1.36-2.24-1.37 0-1.58 1.07-1.58 2.17V18H11V9.5z"
        />
      </svg>
    );
  }

  // Fallback: Globe
  return (
    <span title={showTooltip ? (platform || 'Web Ad') : undefined} className="inline-flex items-center">
      <Globe className={className + ' text-[#94a3b8]'} />
    </span>
  );
};
