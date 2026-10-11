export type DelhiveryScanDetail = {
  Instructions?: string;
  Scan?: string;
  ScanDateTime?: string;
  StatusDateTime?: string;
  ScannedLocation?: string;
  StatusCode?: string;
};

/**
 * Delhivery returns scans oldest-first in the tracking payload. Select the
 * newest scan explicitly instead of assuming the first array item is latest.
 */
export function getLatestDelhiveryScan(scans: unknown): DelhiveryScanDetail | undefined {
  if (!Array.isArray(scans)) return undefined;

  return scans
    .map((entry: any) => entry?.ScanDetail ?? entry)
    .filter((entry): entry is DelhiveryScanDetail => Boolean(entry && typeof entry === 'object'))
    .reduce<DelhiveryScanDetail | undefined>((latest, current) => {
      if (!latest) return current;

      const latestTime = Date.parse(latest.StatusDateTime || latest.ScanDateTime || '');
      const currentTime = Date.parse(current.StatusDateTime || current.ScanDateTime || '');

      if (Number.isNaN(currentTime)) return latest;
      if (Number.isNaN(latestTime) || currentTime > latestTime) return current;
      return latest;
    }, undefined);
}
