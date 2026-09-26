'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function MemberSettlementPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const memberId = params.userId;
  const { userId: currentUserId } = useBrowserSync();
  React.useEffect(() => {
    if (currentUserId) router.replace(`/settle/new?member=${encodeURIComponent(memberId)}`);
  }, [currentUserId, memberId, router]);
  if (!currentUserId) return <section className="finance-welcome"><p className="finance-kicker">SETTLE WITH A MEMBER</p><h1>Keep the repayment fair.</h1><p>Sign in to check the group’s saved bilateral balance before recording a repayment.</p><Link className="finance-primary-link" href="/sign-in">Sign in <ArrowRight size={16} /></Link><Link className="finance-secondary-action" href="/groups"><ArrowLeft size={15} /> Groups</Link></section>;
  return <div className="finance-page"><p className="finance-muted" role="status"><ArrowLeftRight size={16} /> Opening the repayment form for this member…</p><Link className="finance-secondary-action" href={`/settle/new?member=${encodeURIComponent(memberId)}`}>Continue <ArrowRight size={15} /></Link></div>;
}
