import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../web/button';

export function MobileFinanceNav({
  beforeAdd,
  afterAdd,
  onAdd,
}: {
  beforeAdd: React.ReactNode;
  afterAdd: React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <nav className="finapp-mobile-finance-nav" aria-label="Main navigation">
      <svg
        className="finapp-mobile-finance-nav__shape"
        viewBox="0 0 390 96"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M 0 24 L 121 24 C 138 24 136 52 153 60 C 167 66 177 68 195 68 C 213 68 223 66 237 60 C 254 52 252 24 269 24 L 390 24 L 390 96 L 0 96 Z"
          fill="var(--finapp-background)"
          stroke="var(--finapp-border)"
          strokeWidth="1"
        />
      </svg>
      {beforeAdd}
      <Button
        className="finapp-mobile-finance-nav__add"
        size="icon"
        aria-label="Add"
        onPress={onAdd}
      >
        <Plus size={25} strokeWidth={2.2} aria-hidden="true" />
      </Button>
      {afterAdd}
    </nav>
  );
}
