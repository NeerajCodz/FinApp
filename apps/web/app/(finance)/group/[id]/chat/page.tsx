import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupChatPage({ params }: PageProps): Promise<never> {
  const { id } = await params;
  redirect(`/group/${encodeURIComponent(id)}#group-chat`);
}
