import React from 'react';
import { useApp } from '../../context/AppContext';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  title,
  showSubtitle = true,
  className = ''
}) => {
  const { appName } = useApp();
  const displayTitle = title || appName || 'S-Trainer app — Plataforma de Entrenamiento';

  const iconSizes = {
    sm: 'w-6 h-6 rounded-lg p-1',
    md: 'w-10 h-10 rounded-xl p-2',
    lg: 'w-16 h-16 rounded-2xl p-3',
    xl: 'w-24 h-24 rounded-3xl p-5'
  };

  const textSizes = {
    sm: 'text-sm font-extrabold tracking-wider',
    md: 'text-xl font-extrabold tracking-wider',
    lg: 'text-3xl font-extrabold tracking-widest',
    xl: 'text-4xl font-extrabold tracking-widest'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Icon */}
      <div 
        className={`${iconSizes[size]} flex items-center justify-center shadow-lg transition-transform hover:scale-105`}
        style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
      >
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#101012" 
          strokeWidth="3.2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="w-full h-full"
        >
          {/* Dynamic upward arrow */}
          <path d="M4 17 L10 11 L14 15 L20 7" />
          <path d="M14 7 H20 V13" />
        </svg>
      </div>

      {/* Brand Text */}
      <h1 className={`${textSizes[size]} font-display text-[#F5F4F0] mt-2 tracking-wide font-extrabold text-center max-w-[280px] leading-tight`}>
        {displayTitle}
      </h1>

      {showSubtitle && (
        <p className="text-[9px] tracking-[0.2em] text-[#8E8E94] font-semibold uppercase mt-0.5">
          ENTRENA · REPITE · PROGRESA
        </p>
      )}
    </div>
  );
};

