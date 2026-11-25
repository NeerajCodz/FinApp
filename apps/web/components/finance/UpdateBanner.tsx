'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { updateRequired } from '@finapp/ui/version';

/**
 * Shown when this tab is running a web build older than the backend supports (e.g. a tab left
 * open across a release). Reloading picks up the deployed version.
 */
export function UpdateBanner() {
  const backend = useQuery(api.system.info, {});
  if (updateRequired('web', backend) !== true) return null;
  return (
    <div className="finance-update-banner" role="alert">
      <span>A newer version of Finapp is available.</span>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
