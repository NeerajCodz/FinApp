'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { NewSplitForm } from '../NewSplitForm';

export default function NewSplitPage() {
  return (
    <React.Suspense
      fallback={
        <main className="finance-page">
          <p className="finance-muted" role="status">
            Opening split form…
          </p>
        </main>
      }
    >
      <SplitRoute />
    </React.Suspense>
  );
}

function SplitRoute() {
  const searchParams = useSearchParams();
  return <NewSplitForm fixedGroupId={searchParams.get('groupId') ?? undefined} />;
}
