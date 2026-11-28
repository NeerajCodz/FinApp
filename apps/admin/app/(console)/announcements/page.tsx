'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { Button, Input, Switch } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import {
  Empty,
  Loading,
  PageHeader,
  Panel,
  Pill,
  RequirePermission,
  Select,
} from '@/components/ui';
import { errorText, formatDate } from '@/lib/format';

type Severity = 'info' | 'warning' | 'critical';

function Announcements() {
  const rows = useQuery(api.admin.announcements.list, {});
  const create = useMutation(api.admin.announcements.create);
  const setActive = useMutation(api.admin.announcements.setActive);
  const remove = useMutation(api.admin.announcements.remove);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('info');
  const [days, setDays] = useState('7');
  return (
    <div className="admin-two">
      <Panel title="New announcement" description="Shown at the top of Finapp for everyone.">
        <div className="admin-form">
          <label className="admin-field">
            <span>Title</span>
            <Input value={title} maxLength={120} onChangeText={setTitle} />
          </label>
          <label className="admin-field">
            <span>Message</span>
            <textarea
              className="admin-textarea"
              value={body}
              maxLength={2000}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <div className="admin-toolbar">
            <Select
              label="Severity"
              value={severity}
              onChange={(value) => setSeverity(value as Severity)}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <Select
              label="Show for"
              value={days}
              onChange={setDays}
              options={[
                { value: '1', label: '1 day' },
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '0', label: 'Until turned off' },
              ]}
            />
          </div>
          <div>
            <Button
              disabled={!title.trim() || !body.trim()}
              onPress={async () => {
                try {
                  const now = Date.now();
                  await create({
                    title,
                    body,
                    severity,
                    ...(days !== '0' ? { endsAt: now + Number(days) * 86_400_000 } : {}),
                  });
                  setTitle('');
                  setBody('');
                  toast.success('Announcement posted');
                } catch (cause) {
                  toast.error(errorText(cause));
                }
              }}
            >
              Post
            </Button>
          </div>
        </div>
      </Panel>
      <Panel title="Announcements">
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>Nothing posted yet.</Empty>
        ) : (
          <div className="admin-thread">
            {rows.map((row) => (
              <article key={row.id} className="admin-message">
                <header>
                  <Pill
                    tone={
                      row.severity === 'critical'
                        ? 'bad'
                        : row.severity === 'warning'
                          ? 'warn'
                          : 'accent'
                    }
                  >
                    {row.severity}
                  </Pill>
                  <strong>{row.title}</strong>
                  <span style={{ marginLeft: 'auto' }}>
                    {formatDate(row.startsAt)}
                    {row.endsAt ? ` – ${formatDate(row.endsAt)}` : ''}
                  </span>
                </header>
                <p>{row.body}</p>
                <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
                  <Switch
                    label="Active"
                    value={row.active}
                    onValueChange={async (active) => {
                      try {
                        await setActive({ announcementId: row.id, active });
                      } catch (cause) {
                        toast.error(errorText(cause));
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={async () => {
                      try {
                        await remove({ announcementId: row.id });
                      } catch (cause) {
                        toast.error(errorText(cause));
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <RequirePermission any={['MANAGE_ANNOUNCEMENTS']}>
      <PageHeader title="Announcements" description="System notices for every Finapp user." />
      <Announcements />
    </RequirePermission>
  );
}
