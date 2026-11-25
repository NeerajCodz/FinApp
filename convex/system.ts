/**
 * Public, data-free facts about the running backend, so clients can check compatibility and
 * the app can show what is deployed. Versions come from version.json (via shared/version.ts).
 */
import { query } from './_generated/server';
import {
  BACKEND_INFO,
  COMPONENT_VERSIONS,
  PRODUCT_VERSION,
  RELEASE_CHANNEL,
} from './shared/version';

export const info = query({
  args: {},
  handler: async () => ({
    ...BACKEND_INFO,
    productVersion: PRODUCT_VERSION,
    channel: RELEASE_CHANNEL,
    components: COMPONENT_VERSIONS,
  }),
});
