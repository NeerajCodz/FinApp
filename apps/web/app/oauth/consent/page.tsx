import type { Metadata } from 'next';
import { AppConsentScreen } from './screen';
import '../../mcp/auth.css';

export const metadata: Metadata = {
  title: 'Review app access — Finapp',
  robots: { index: false, follow: false },
};

/** Consent for third-party apps using the public API (OAuth 2.1 code + PKCE). */
export default function AppConsentPage() {
  return <AppConsentScreen />;
}
