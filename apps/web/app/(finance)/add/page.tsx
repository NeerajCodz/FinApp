import { redirect } from 'next/navigation';

export default function AddPage(): never {
  redirect('/dashboard');
}
