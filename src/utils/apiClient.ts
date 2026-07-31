import { getTailscaleIp } from './offlineStore';

export function buildDirectUrl(endpoint: string, ipInput?: string): string {
  let target = (ipInput || getTailscaleIp()).trim();
  if (!target) target = '100.112.45.19';

  if (!/^https?:\/\//i.test(target)) {
    if (!target.includes(':')) {
      target = `http://${target}:3004`;
    } else {
      target = `http://${target}`;
    }
  }

  const baseUrl = target.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

export async function smartFetchApi(
  endpoint: string,
  init?: RequestInit,
  customIp?: string
): Promise<{ res: Response; text: string; data: any }> {
  const ip = customIp || getTailscaleIp();
  const isStaticHost = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
  const isFullUrl = /^https?:\/\//i.test(ip.trim());

  // Strategy 1: Direct fetch to target URL (e.g. Tailscale Serve https://...ts.net or direct IP)
  // Essential for GitHub Pages (static host with no Express backend)
  if (isStaticHost || isFullUrl) {
    try {
      const directUrl = buildDirectUrl(endpoint, ip);
      const directRes = await fetch(directUrl, init);
      const directText = await directRes.text();

      if (!directText.trim().startsWith('<') && !directText.includes('<html')) {
        let parsedData: any = null;
        try {
          parsedData = JSON.parse(directText);
        } catch {
          parsedData = directText;
        }
        return { res: directRes, text: directText, data: parsedData };
      }
    } catch (directErr) {
      if (isStaticHost) {
        throw directErr;
      }
    }
  }

  // Strategy 2: Relative proxy route (/api/...?ip=...) on full-stack server environments
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const proxyUrl = `${cleanEndpoint}${cleanEndpoint.includes('?') ? '&' : '?'}ip=${encodeURIComponent(ip)}`;

  try {
    const proxyRes = await fetch(proxyUrl, init);
    const proxyText = await proxyRes.text();

    if (!proxyText.trim().startsWith('<') && !proxyText.includes('<html')) {
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(proxyText);
      } catch {
        parsedData = proxyText;
      }
      return { res: proxyRes, text: proxyText, data: parsedData };
    }
  } catch (proxyErr) {
    // Fallthrough to direct fallback attempt below
  }

  // Strategy 3: Final fallback to direct URL
  const directUrl = buildDirectUrl(endpoint, ip);
  const directRes = await fetch(directUrl, init);
  const directText = await directRes.text();

  if (directText.trim().startsWith('<') || directText.includes('<html')) {
    throw new Error(`Connection failed: Response from ${directUrl} returned HTML instead of JSON.`);
  }

  let parsedData: any = null;
  try {
    parsedData = JSON.parse(directText);
  } catch {
    parsedData = directText;
  }
  return { res: directRes, text: directText, data: parsedData };
}
