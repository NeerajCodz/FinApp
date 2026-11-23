import { RouteStatus } from '@/components/feedback/RouteStatus';

export default function NotFound() {
  return (
    <RouteStatus
      scene="search"
      title="This page doesn’t exist."
      description="The link may be outdated, or the item was removed."
    />
  );
}
