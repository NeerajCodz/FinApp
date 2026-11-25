import type { ReactNode } from 'react';
import { ProfileFrame } from './ProfileFrame';

export default function PublicProfileLayout({ children }: { children: ReactNode }) {
  return <ProfileFrame>{children}</ProfileFrame>;
}
