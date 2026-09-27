
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewGroupExpenseRedirect({ params }: PageProps): Promise<never> {
  const { id } = await params;
  redirect(`/split/new?groupId=${encodeURIComponent(id)}`);
}
