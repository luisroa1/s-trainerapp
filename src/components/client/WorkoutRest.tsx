import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Plus } from 'lucide-react';

interface WorkoutRestProps {
  onBack: () => void;
  onFinishRest: () => void;
  recordedInfo?: {
    setNum: number;
    weight: number;
    reps: number;
    targetSets?: number;
    targetWeight?: number;
    targetReps?: number;
    targetRir?: number;
  };
}

export const WorkoutRest: React.FC<WorkoutRestProps> = ({
  onBack,
  onFinishRest,
  recordedInfo = { setNum: 1, weight: 0, reps: 0, targetSets: 1, targetWeight: 0, targetReps: 0, targetRir: 0 }
}) => {
  const targetSets = recordedInfo.targetSets ?? recordedInfo.setNum;
  const nextSetNum = Math.min(targetSets, recordedInfo.setNum + 1);
  const totalSecondsInitial = 90; // 1:30 min (descanso por defecto entre series)
  const [secondsRemaining, setSecondsRemaining] = useState(totalSecondsInitial);
  const [totalSeconds, setTotalSeconds] = useState(totalSecondsInitial);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsRemaining]);

  const addTime = (secs: number) => {
    setSecondsRemaining(prev => prev + secs);
    setTotalSeconds(prev => Math.max(prev, secondsRemaining + secs));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // SVG circle calculation
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalSeconds > 0 ? (totalSeconds - secondsRemaining) / totalSeconds : 0;
  const strokeDashoffset = circumference * progressRatio;

  return (
    <div className="flex flex-col justify-between min-h-full pb-8 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-bold tracking-widest text-[#8E8E94] uppercase">
            DESCANSO
          </span>

          <div className="w-9 h-9" />
        </div>

        {/* Registered status pill */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 text-center mb-6">
          <Check className="w-4 h-4 text-[var(--accent-color,#CFFF5C)] stroke-[2.5]" />
          <span className="text-xs font-semibold text-[#F5F4F0]">
            Serie {recordedInfo.setNum} registrada — {recordedInfo.weight.toString().replace('.', ',')} kg × {recordedInfo.reps}
          </span>
        </div>

        {/* Big Circular Countdown */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="glow-accent relative w-52 h-52 flex items-center justify-center rounded-full">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="104"
                cy="104"
                r={radius}
                stroke="#232328"
                strokeWidth="10"
                fill="none"
              />
              {/* Animated active arc */}
              <circle
                cx="104"
                cy="104"
                r={radius}
                stroke="var(--accent-color, #CFFF5C)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            {/* Inner text */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold font-display text-[#F5F4F0] tracking-tight">
                {formatTime(secondsRemaining)}
              </span>
              <span className="text-xs text-[#8E8E94] mt-1 font-medium">
                de {formatTime(totalSeconds)} min
              </span>
            </div>
          </div>

          {/* Time add buttons */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={() => addTime(15)}
              className="px-5 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
            >
              +15 s
            </button>
            <button
              onClick={() => addTime(30)}
              className="px-5 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
            >
              +30 s
            </button>
          </div>

          {/* Skip rest link */}
          <button
            onClick={onFinishRest}
            className="mt-4 text-xs font-semibold text-[#8E8E94] hover:text-[#CFFF5C] transition-colors"
          >
            Saltar descanso
          </button>
        </div>
      </div>

      {/* Card SIGUIENTE */}
      <div 
        onClick={onFinishRest}
        className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] cursor-pointer hover:border-[#3A3A40] transition-colors"
      >
        <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
          SIGUIENTE
        </span>
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-[#F5F4F0]">
            Serie {nextSetNum} de {targetSets}
          </h4>
          <span className="text-xs font-semibold text-[#8E8E94]">
            {(recordedInfo.targetWeight ?? 0).toString().replace('.', ',')} kg · {recordedInfo.targetReps ?? 0} reps · RIR {recordedInfo.targetRir ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
};
