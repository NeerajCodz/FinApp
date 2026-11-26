import { describe, expect, it } from 'vitest';
import {
  avatarPhotoProblem,
  phoneProblem,
  profileChanges,
  profileDraftFrom,
  profileSaveErrorText,
  searchTimezones,
  timezoneLabel,
  validateProfileDraft,
  type ProfileDraft,
} from '../../packages/ui/src/finance/profileForm';

const base: ProfileDraft = profileDraftFrom(
  {
    displayName: 'Asha Rao',
    username: 'asha',
    phone: '+919876543210',
    timezone: 'Asia/Kolkata',
    avatarId: 'AV3',
    gender: 'female',
  },
  'UTC',
);

describe('profile draft', () => {
  it('derives the avatar from the saved profile', () => {
    expect(base.avatar).toEqual({ kind: 'preset', avatarId: 'AV3', gender: 'female' });
    expect(profileDraftFrom({ avatarUrl: 'https://x/y.png' }).avatar).toEqual({
      kind: 'photo',
      url: 'https://x/y.png',
    });
    expect(profileDraftFrom({}, 'Europe/Paris')).toMatchObject({
      avatar: { kind: 'none' },
      timezone: 'Europe/Paris',
    });
  });

  it('validates every field', () => {
    expect(validateProfileDraft(base)).toEqual({});
    const errors = validateProfileDraft(
      {
        ...base,
        displayName: ' ',
        username: 'a b',
        bio: 'x'.repeat(161),
        phone: '123',
        timezone: 'Mars/Base',
      },
      'idle',
    );
    expect(Object.keys(errors).sort()).toEqual([
      'bio',
      'displayName',
      'phone',
      'timezone',
      'username',
    ]);
    expect(validateProfileDraft({ ...base, username: 'free_name' }, 'taken').username).toBe(
      'That username is taken.',
    );
    expect(phoneProblem('')).toBeNull();
    expect(phoneProblem('+44 (7700) 900-123')).toBeNull();
  });

  it('reports only what changed', () => {
    expect(profileChanges(base, base)).toEqual({ identity: {}, dirty: false });
    const changes = profileChanges(base, {
      ...base,
      displayName: ' Asha R ',
      username: '@Asha_R',
      bio: ' Hi  there ',
      phone: '+91 98765 43210',
      avatar: { kind: 'preset', avatarId: 'AV4', gender: 'female' },
    });
    expect(changes).toEqual({
      identity: { displayName: 'Asha R', bio: 'Hi there' },
      username: 'asha_r',
      avatar: { kind: 'preset', avatarId: 'AV4', gender: 'female' },
      dirty: true,
    });
    const file = {};
    expect(
      profileChanges(base, { ...base, avatar: { kind: 'newPhoto', previewUrl: 'blob:1', file } })
        .avatar,
    ).toEqual({ kind: 'upload', file });
    expect(
      profileChanges(
        { ...base, avatar: { kind: 'photo', url: 'u' } },
        { ...base, avatar: { kind: 'none' } },
      ).avatar,
    ).toEqual({ kind: 'remove' });
  });
});

describe('time zones and photos', () => {
  const zones = ['UTC', 'Asia/Kolkata', 'Asia/Kathmandu', 'America/New_York', 'Europe/London'];

  it('finds zones by city first, then by region', () => {
    expect(searchTimezones(zones, 'kol')).toEqual(['Asia/Kolkata']);
    expect(searchTimezones(zones, 'asia')).toEqual(['Asia/Kathmandu', 'Asia/Kolkata']);
    expect(searchTimezones(zones, 'new york')).toEqual(['America/New_York']);
    expect(searchTimezones(zones, '')).toHaveLength(5);
    expect(timezoneLabel('America/Argentina/Buenos_Aires')).toEqual({
      city: 'Buenos Aires',
      region: 'America / Argentina',
    });
  });

  it('checks photo type and size', () => {
    expect(avatarPhotoProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(avatarPhotoProblem({ type: 'application/pdf', size: 10 })).toMatch(/JPEG/);
    expect(avatarPhotoProblem({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });

  it('turns server codes into sentences', () => {
    expect(profileSaveErrorText(new Error('Uncaught Error: USERNAME_TAKEN'))).toBe(
      'That username is taken.',
    );
    expect(profileSaveErrorText('weird')).toMatch(/Try again/);
  });
});
