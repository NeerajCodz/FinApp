'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { NewSplitForm } from '../../../split/NewSplitForm';

export default function NewGroupExpensePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <React.Suspense
      fallback={
        <main className="finance-page">
          <p className="finance-muted" role="status">
            Opening group expense form…
          </p>
        </main>
      }
    >
      <NewSplitForm fixedGroupId={id} />
    </React.Suspense>
  );
}
