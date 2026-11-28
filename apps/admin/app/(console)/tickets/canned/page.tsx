'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button, Input } from '@finapp/ui/web';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Empty, Loading, PageHeader, Panel, RequirePermission } from '@/components/ui';
import { useCan } from '@/lib/admin';
import { errorText, timeAgo } from '@/lib/format';

function Canned() {
  const rows = useQuery(api.support.tickets.cannedReplies, {});
  const save = useMutation(api.support.tickets.saveCannedReply);
  const remove = useMutation(api.support.tickets.deleteCannedReply);
  const can = useCan();
  const [editing, setEditing] = useState<Id<'cannedReplies'> | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const reset = () => {
    setEditing(null);
    setTitle('');
    setBody('');
  };
  return (
    <div className="admin-two">
      {can('MANAGE_TICKETS') ? (
        <Panel title={editing ? 'Edit reply' : 'New canned reply'}>
          <div className="admin-form">
            <label className="admin-field">
              <span>Title</span>
              <Input value={title} maxLength={80} onChangeText={setTitle} />
            </label>
            <label className="admin-field">
              <span>Message</span>
              <textarea
                className="admin-textarea"
                style={{ minHeight: 160 }}
                value={body}
                maxLength={5000}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <div className="admin-actions">
              <Button
                disabled={!title.trim() || !body.trim()}
                onPress={async () => {
                  try {
                    await save({ ...(editing ? { id: editing } : {}), title, body });
                    toast.success('Saved');
                    reset();
                  } catch (cause) {
                    toast.error(errorText(cause));
                  }
                }}
              >
                Save
              </Button>
              {editing ? (
                <Button variant="ghost" onPress={reset}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}
      <Panel title="Replies">
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>No canned replies yet.</Empty>
        ) : (
          <div className="admin-thread">
            {rows.map((row) => (
              <article key={row.id} className="admin-message">
                <header>
                  <strong>{row.title}</strong>
                  <span style={{ marginLeft: 'auto' }}>{timeAgo(row.updatedAt)}</span>
                </header>
                <p>{row.body}</p>
                {can('MANAGE_TICKETS') ? (
                  <div className="admin-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setEditing(row.id);
                        setTitle(row.title);
                        setBody(row.body);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={async () => {
                        try {
                          await remove({ id: row.id });
                        } catch (cause) {
                          toast.error(errorText(cause));
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function CannedRepliesPage() {
  return (
    <RequirePermission any={['VIEW_TICKETS']}>
      <Link href="/tickets" className="admin-muted" style={{ display: 'inline-flex', gap: 6 }}>
        <ArrowLeft size={16} aria-hidden /> Tickets
      </Link>
      <PageHeader title="Canned replies" description="Reusable answers for common questions." />
      <Canned />
    </RequirePermission>
  );
}
