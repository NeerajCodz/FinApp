import { SignedInRedirect } from '@/components/auth/SignedInRedirect';
import { SignUpForm } from '@/components/auth/SignUpForm';

export default function SignUpPage() {
  return (
    <>
      <SignedInRedirect />
      <SignUpForm />
    </>
  );
}
