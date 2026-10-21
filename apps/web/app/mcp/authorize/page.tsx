import type { Metadata } from 'next';
import { McpAuthorizeScreen } from './screen';
import '../auth.css';

export const metadata: Metadata = {
  title: 'Review AI client access — Finapp',
  robots: { index: false, follow: false },
};

export default function McpAuthorizePage() {
  return <McpAuthorizeScreen />;
}
