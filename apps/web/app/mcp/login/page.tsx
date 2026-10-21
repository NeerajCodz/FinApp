import type { Metadata } from 'next';
import { McpLoginScreen } from './screen';
import '../auth.css';

export const metadata: Metadata = {
  title: 'Connect your account — Finapp',
  robots: { index: false, follow: false },
};

export default function McpLoginPage() {
  return <McpLoginScreen />;
}
