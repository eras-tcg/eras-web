/**
 * Asks the browser not to clear what the site keeps when space runs low (navigator.storage.persist). Asked only when
 * the player shows they want the game on the device (installing it, keeping the game for offline), never on a
 * first visit. Resolves whether the storage is persistent.
 */
export async function persistStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** What the browser tells about the connection (Network Information API: Chromium; elsewhere nothing). */
interface NetworkInformationLike {
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
}

/**
 * Whether a big download should be warned about: the player asked to save data, the connection is a phone's
 * (cellular) or very slow. Null when the browser does not say (Safari, Firefox).
 */
export function costlyConnection(connection: NetworkInformationLike | undefined = (navigator as { connection?: NetworkInformationLike }).connection): {
  saveData: boolean;
  metered: boolean;
  slow: boolean;
} | null {
  if (!connection) return null;
  return {
    saveData: connection.saveData === true,
    metered: connection.type === 'cellular',
    slow: connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g',
  };
}
