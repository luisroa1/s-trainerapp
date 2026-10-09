import React from 'react';
import brandMark from '../../assets/trainer-visual/brand-s-trainer-reference.png';
import iconSprite from '../../assets/trainer-visual/trainer-icons.svg?url';

export const TRAINER_COLORS = {
  background: '#080F14',
  panel: '#111B23',
  border: '#29343E',
  text: '#E8EDF2',
  muted: '#A5B3C0',
  cyan: '#00BCE8',
  training: '#00C9F4',
  nutrition: '#00E575',
  progress: '#00D5C5',
  followup: '#DA49F5',
  gold: '#FFD21F',
  neutral: '#B9D2FF',
} as const;

export type TrainerIconName =
  | 'clients' | 'programs' | 'library' | 'agenda' | 'help'
  | 'training' | 'nutrition' | 'progress' | 'followup' | 'reports'
  | 'inviteClient' | 'notification' | 'arrowRight' | 'chevronDown' | 'programsCard';

const ICON_COLORS: Partial<Record<TrainerIconName, string>> = {
  clients: TRAINER_COLORS.cyan,
  programs: TRAINER_COLORS.gold,
  library: TRAINER_COLORS.cyan,
  agenda: TRAINER_COLORS.followup,
  help: TRAINER_COLORS.neutral,
  training: TRAINER_COLORS.training,
  nutrition: TRAINER_COLORS.nutrition,
  progress: TRAINER_COLORS.progress,
  followup: TRAINER_COLORS.followup,
  reports: TRAINER_COLORS.gold,
  inviteClient: TRAINER_COLORS.neutral,
  notification: TRAINER_COLORS.neutral,
  programsCard: TRAINER_COLORS.gold,
};

const ICON_VIEWBOX: Record<TrainerIconName, string> = {
  clients: '0 0 39 39', programs: '0 0 38 39', library: '0 0 38 39',
  agenda: '0 0 38 39', help: '0 0 39 39', training: '0 0 49 45',
  nutrition: '0 0 50 49', progress: '0 0 47 52', followup: '0 0 49 48',
  reports: '0 0 48 51', inviteClient: '0 0 56 54', notification: '0 0 36 38',
  arrowRight: '0 0 29 28', chevronDown: '0 0 27 25', programsCard: '0 0 43 49',
};

export function TrainerBrandMark({ className = '' }: { className?: string }) {
  return <img src={brandMark} alt="S-TRAINER" className={`h-12 w-[171px] object-contain ${className}`} />;
}

export function TrainerIcon({
  name,
  size = 32,
  className = '',
}: {
  name: TrainerIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox={ICON_VIEWBOX[name]}
      className={`shrink-0 ${className}`}
      style={{ color: ICON_COLORS[name] ?? 'currentColor' }}
    >
      <use href={`${iconSprite}#${name}`} />
    </svg>
  );
}

export function TrainerIconFrame({
  name,
  size = 74,
  iconSize = 48,
  className = '',
}: {
  name: TrainerIconName;
  size?: number;
  iconSize?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[8px] border border-[#29343E] bg-[#0E1921] ${className}`}
      style={{ width: size, height: size, borderColor: 'var(--trainer-border)' }}
    >
      <TrainerIcon name={name} size={iconSize} />
    </span>
  );
}
