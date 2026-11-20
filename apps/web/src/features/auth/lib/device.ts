/** "Chrome on Android", "Safari on iPhone"… from a user-agent string (best effort, display only). */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browsers: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/SamsungBrowser\//, 'Samsung Internet'],
    [/OPR\/|Opera/, 'Opera'],
    [/Firefox\/|FxiOS\//, 'Firefox'],
    [/Chrome\/|CriOS\//, 'Chrome'],
    [/Safari\//, 'Safari'],
  ];
  const systems: [RegExp, string][] = [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/Windows/, 'Windows'],
    [/Mac OS X|Macintosh/, 'Mac'],
    [/Linux/, 'Linux'],
  ];
  const browser = browsers.find(([re]) => re.test(userAgent))?.[1];
  const os = systems.find(([re]) => re.test(userAgent))?.[1];
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown device';
}
