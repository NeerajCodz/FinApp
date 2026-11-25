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
