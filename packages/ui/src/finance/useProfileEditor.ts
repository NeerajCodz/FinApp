import React from 'react';
import {
  profileChanges,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileErrors,
  type ProfileField,
  type UsernameStatus,
} from './profileForm';

/**
 * Draft state for the profile editor: starts from the saved profile once it loads, tracks which
 * fields were touched (errors show after blur or a save attempt), and reports what changed.
 */
export function useProfileEditor(
  initial: ProfileDraft | undefined,
  usernameStatus: UsernameStatus,
) {
  const [baseline, setBaseline] = React.useState<ProfileDraft | undefined>(initial);
  const [draft, setDraft] = React.useState<ProfileDraft | undefined>(initial);
  const [touched, setTouched] = React.useState<ReadonlySet<ProfileField>>(new Set());
  const [attempted, setAttempted] = React.useState(false);

  React.useEffect(() => {
    if (!initial || baseline) return;
    setBaseline(initial);
    setDraft(initial);
  }, [initial, baseline]);

  const errors: ProfileErrors = React.useMemo(
    () => (draft ? validateProfileDraft(draft, usernameStatus) : {}),
    [draft, usernameStatus],
  );
  const changes = React.useMemo(
    () => (draft && baseline ? profileChanges(baseline, draft) : null),
    [draft, baseline],
  );
  const visibleErrors: ProfileErrors = React.useMemo(() => {
    const shown: ProfileErrors = {};
    for (const [field, message] of Object.entries(errors) as [ProfileField, string][])
      if (attempted || touched.has(field)) shown[field] = message;
    return shown;
  }, [errors, touched, attempted]);

  const update = React.useCallback(
    <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    },
    [],
  );
  const touch = React.useCallback((field: ProfileField) => {
    setTouched((current) => (current.has(field) ? current : new Set([...current, field])));
  }, []);
  const discard = React.useCallback(() => {
    setDraft(baseline);
    setTouched(new Set());
    setAttempted(false);
  }, [baseline]);
  /** After a successful save: the draft becomes the new saved state. */
  const commit = React.useCallback((next: ProfileDraft) => {
    setBaseline(next);
    setDraft(next);
    setTouched(new Set());
    setAttempted(false);
  }, []);

  return {
    draft,
    baseline,
    errors,
    visibleErrors,
    changes,
    dirty: Boolean(changes?.dirty),
    valid: Object.keys(errors).length === 0,
    update,
    touch,
    discard,
    commit,
    attemptSave: () => setAttempted(true),
  };
}
