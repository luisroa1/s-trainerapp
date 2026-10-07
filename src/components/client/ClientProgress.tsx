import React from 'react';
import { useApp } from '../../context/AppContext';
import { TrendingDown, ArrowRight, MessageSquare, Camera } from 'lucide-react';

interface ClientProgressProps {
  onOpenMeasurements: () => void;
  onOpenPhotos: () => void;
}

export const ClientProgress: React.FC<ClientProgressProps> = ({
  onOpenMeasurements,
  onOpenPhotos
}) => {
  const { activeClient } = useApp();

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Title */}
      <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] mb-5">
        Mi progreso
      </h2>

      {/* Card PESO */}
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
            PESO
          </span>
          <div className="flex items-center gap-1 text-[#5CD6FF] text-xs font-semibold">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>0,4 kg / semana</span>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-3xl font-extrabold font-display text-[#F5F4F0]">
            {typeof activeClient.currentWeight === 'number'
              ? `${activeClient.currentWeight.toFixed(1).replace('.', ',')} kg`
              : 'Sin datos'}
          </span>
        </div>

        {/* Weight linear trend SVG chart */}
        <div className="relative w-full h-24 mb-3">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 320 80">
            {/* Background horizontal guideline */}
            <line x1="0" y1="65" x2="320" y2="65" stroke="#2A2A2F" strokeDasharray="3 3" strokeWidth="1" />
            {/* Smooth downward trend curve */}
            <path
              d="M 10 20 Q 80 25, 160 38 T 310 65"
              fill="none"
              stroke="#5CD6FF"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Points */}
            <circle cx="10" cy="20" r="4" fill="#5CD6FF" />
            <circle cx="160" cy="38" r="5" fill="#5CD6FF" className="animate-pulse" />
            <circle cx="310" cy="65" r="4" fill="#2A2A2F" stroke="#5CD6FF" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex items-center justify-between text-xs text-[#8E8E94]">
          <span>Inicial {activeClient.initialWeight.toFixed(1).replace('.', ',')} kg</span>
          <span>Objetivo {activeClient.targetWeight.toFixed(1).replace('.', ',')} kg</span>
        </div>
      </div>

      {/* Card Adherencia */}
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] mb-4 flex items-center gap-4">
        {/* Circular Progress 89% */}
        <div className="glow-accent relative w-20 h-20 flex items-center justify-center shrink-0 rounded-full">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r="32" stroke="#232328" strokeWidth="6" fill="none" />
            <circle
              cx="40"
              cy="40"
              r="32"
              stroke="var(--accent-color, #CFFF5C)"
              strokeWidth="6"
              strokeDasharray="201"
              strokeDashoffset="22"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span className="absolute text-sm font-extrabold font-display text-[#F5F4F0]">
            {activeClient.adherencePercentage}%
          </span>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#F5F4F0]">
            Adherencia — últimos 30 días
          </h4>
          <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
            {activeClient.completedWorkoutsCount} de {activeClient.totalScheduledWorkoutsCount} entrenamientos completados
          </p>
        </div>
      </div>

      {/* Card Fuerza */}
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] mb-4">
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3">
          FUERZA
        </span>
        <div className="space-y-3">
          {activeClient.strengthProgression.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 border-b border-[#2A2A2F]/40 last:border-none">
              <span className="text-xs font-semibold text-[#F5F4F0]">{item.exercise}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8E8E94]">{item.previousWeight} kg</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
                <span className="text-xs font-bold text-[var(--accent-color,#CFFF5C)]">{item.currentWeight} kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2 Bottom Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          onClick={onOpenMeasurements}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <MessageSquare className="w-5 h-5 text-[#8E8E94] mb-2" />
          <h4 className="text-xs font-bold text-[#F5F4F0]">Medidas</h4>
          <p className="text-[10px] text-[#8E8E94] mt-0.5">
            {activeClient.bodyMeasurements.lastUpdated}
          </p>
        </div>

        <div 
          onClick={onOpenPhotos}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <Camera className="w-5 h-5 text-[#8E8E94] mb-2" />
          <h4 className="text-xs font-bold text-[#F5F4F0]">Fotos</h4>
          <p className="text-[10px] text-[#8E8E94] mt-0.5">
            3 fotos guardadas
          </p>
        </div>
      </div>
    </div>
  );
};
