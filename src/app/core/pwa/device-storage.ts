/** How much this site keeps on the device and how much it may (navigator.storage.estimate), in bytes. */
export interface StorageUsage {
  usage: number;
  quota: number;
}

/** What the browser says the site uses and may use, or null when it cannot tell. */
export async function storageUsage(): Promise<StorageUsage | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate || estimate.usage === undefined || estimate.quota === undefined) return null;
    return { usage: estimate.usage, quota: estimate.quota };
  } catch {
    return null;
  }
}

/**
 * Asks the browser not to clear what the site keeps when space runs low (navigator.storage.persist). Asked only when
 * the player shows they want the game on the device (installing it, downloading the cards for offline), never on a
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

/** "12,3 MB" (es). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toLocaleString('es', { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / 1024 ** 3).toLocaleString('es', { maximumFractionDigits: 1 })} GB`;
}
