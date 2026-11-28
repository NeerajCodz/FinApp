'use client';

import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { Switch } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import { PERMISSION_LABELS } from '@convex/admin/permissions';
import { Loading, PageHeader, Panel, RoleChip } from '@/components/ui';
import { useAdmin, useCan } from '@/lib/admin';
import { errorText } from '@/lib/format';

const SETTINGS: {
  key: 'requireStaffMfa' | 'supportAi' | 'supportOpen';
  label: string;
  hint: string;
}[] = [
  {
    key: 'requireStaffMfa',
    label: 'Require two-factor sign-in for staff',
    hint: 'Staff without an authenticator app or email codes can’t use the console. Owners are exempt so the console can’t lock itself out.',
  },
  {
    key: 'supportAi',
    label: 'AI for support tickets',
    hint: 'Triage, summaries, duplicate detection and suggested replies. The model sees only ticket text.',
  },
  {
    key: 'supportOpen',
    label: 'Accept new support tickets',
    hint: 'Turn off to pause new tickets (existing threads keep working).',
  },
];

export default function SettingsPage() {
  const me = useAdmin();
  const can = useCan();
  const settings = useQuery(api.admin.announcements.settings, {});
  const update = useMutation(api.admin.announcements.updateSetting);
  return (
    <>
      <PageHeader title="Settings" description="Console settings and your access." />
      <div className="admin-two">
        <Panel title="Console">
          {!settings ? (
            <Loading />
          ) : (
            <div className="admin-perms">
              {SETTINGS.map((setting) => (
                <div key={setting.key} className="admin-perm">
                  <div>
                    <strong>{setting.label}</strong>
                    <small>{setting.hint}</small>
                  </div>
                  <Switch
                    label={setting.label}
                    value={Boolean(settings[setting.key])}
                    disabled={!can('MANAGE_SETTINGS')}
                    onValueChange={async (value) => {
                      try {
                        await update({ key: setting.key, value });
                      } catch (cause) {
                        toast.error(errorText(cause));
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Your access">
          <div className="admin-form">
            <div className="admin-actions">
              {me.roles.map((role) => (
                <RoleChip key={role.id} role={role} />
              ))}
            </div>
            <p className="admin-muted" style={{ margin: 0 }}>
              Two-factor sign-in: {me.mfaEnabled ? 'on' : 'off'}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {me.permissions.map((permission) => (
                <li key={permission}>
                  {PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS]?.label ??
                    permission}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
      <Panel title="Privacy">
        <p className="admin-muted" style={{ margin: 0 }}>
          The console shows usage, account metadata, security and moderation only. It never shows
          transaction amounts, balances, merchants, notes, categories, budgets, goals, chat or FinAI
          content, receipts or attachments. Free text written to staff is encrypted at rest. See
          apps/admin/PRIVACY.md.
        </p>
      </Panel>
    </>
  );
}
