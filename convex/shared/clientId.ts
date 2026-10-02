const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertClientId(clientId: string | undefined): void {
  if (clientId !== undefined && !UUID_V4.test(clientId)) throw new Error('INVALID_CLIENT_ID');
}

export async function assertClientIdAvailable(
  clientId: string | undefined,
  findExisting: () => Promise<unknown>,
): Promise<void> {
  assertClientId(clientId);
  if (clientId !== undefined && (await findExisting())) throw new Error('CLIENT_ID_COLLISION');
}
