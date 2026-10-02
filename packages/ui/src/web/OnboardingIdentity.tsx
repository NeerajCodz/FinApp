'use client';

import { Check } from 'lucide-react';
import { Avatar } from './fields';

type AvatarChoice = { avatarId: string; url: string };

type ProfilePreviewProps = {
  displayName: string;
  username: string;
  avatarUrl?: string;
};

export function ProfilePreview({ displayName, username, avatarUrl }: ProfilePreviewProps) {
  const name = displayName.trim() || 'Your name';
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="finapp-onboarding-profile" aria-live="polite">
      <Avatar initials={initials} label={name} imageUrl={avatarUrl} size={68} />
      <div className="finapp-onboarding-profile__copy">
        <span className="finapp-onboarding-profile__eyebrow">PROFILE PREVIEW</span>
        <strong>{name}</strong>
        <span>@{username || 'username'}</span>
      </div>
    </div>
  );
}

export function OnboardingAvatarPicker({
  choices,
  selectedId,
  label,
  onSelect,
}: {
  choices: AvatarChoice[];
  selectedId: string;
  label: string;
  onSelect: (avatarId: string) => void;
}) {
  return (
    <div className="finapp-onboarding-avatar-picker" role="group" aria-label={label}>
      {choices.map((avatar) => (
        <button
          key={avatar.avatarId}
          type="button"
          aria-label={`Select avatar ${avatar.avatarId}`}
          aria-pressed={selectedId === avatar.avatarId}
          onClick={() => onSelect(avatar.avatarId)}
          className="finapp-onboarding-avatar-picker__choice"
          data-selected={selectedId === avatar.avatarId || undefined}
        >
          <Avatar initials="" label={avatar.avatarId} imageUrl={avatar.url} size={42} />
          {selectedId === avatar.avatarId && (
            <span className="finapp-onboarding-avatar-picker__check" aria-hidden="true">
              <Check size={11} strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
