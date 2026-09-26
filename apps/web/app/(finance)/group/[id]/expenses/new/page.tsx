'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Split } from 'lucide-react';
import { Button } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function NewGroupExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  React.useEffect(() => {
    if (userId) router.replace(`/split/new?groupId=${encodeURIComponent(id)}`);
  }, [id, router, userId]);
  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">NEW GROUP EXPENSE</p>
        <h1>Split a shared cost.</h1>
        <p>
          Sign in to record the expense locally and sync its allocation through the group outbox.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
        <Link className="finance-secondary-action" href={`/group/${encodeURIComponent(id)}`}>
          <ArrowLeft size={15} /> Back to group
        </Link>
      </section>
    );
  return (
    <div className="finance-page">
      <p className="finance-muted" role="status">
        <Split size={16} /> Opening the split form…
      </p>
      <Button
        variant="outline"
        onPress={() => router.replace(`/split/new?groupId=${encodeURIComponent(id)}`)}
      >
        Continue to split <ArrowRight size={15} />
      </Button>
    </div>
  );
}
