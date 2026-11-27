import { getAuthenticatedUser } from './guidePrApi.js';
import { contributorIdentity } from './contributorSubmission.js';

export async function captureGuideLoad(load) {
  const before = await getAuthenticatedUser().catch(() => null);
  const guide = await load();
  const after = await getAuthenticatedUser().catch(() => null);
  if (contributorIdentity(before) !== contributorIdentity(after)) {
    throw new Error('Account changed while loading. Load the source again with the intended contributor. Existing drafts are retained.');
  }
  return { ...guide, expectedContributor: contributorIdentity(before) };
}
