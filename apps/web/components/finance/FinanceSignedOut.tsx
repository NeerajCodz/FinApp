'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinanceSignedOut({
  section,
  title,
  description,
}: {
  section: string;
  title: string;
  description: string;
}) {
  return (
    <section className="finance-welcome">
      <p className="finance-kicker">{section}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link className="finance-primary-link" href="/sign-in">
        Sign in <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <p>
        New to Finapp?{' '}
        <Link className="finance-inline-link" href="/sign-up">
          Create an account
        </Link>
      </p>
    </section>
  );
}
