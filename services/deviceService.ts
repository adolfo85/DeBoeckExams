/**
 * Device identification and fingerprinting service.
 * Identifies devices across sessions using persistent UUID + hardware signature,
 * enabling cross-referencing in audit logs to detect fraudulent or multiple identity usage.
 */

export interface DeviceProfile {
  deviceId: string;
  fingerprint: string;
  deviceInfo: string;
  ip: string;
}

const STORAGE_KEYS = {
  DEVICE_UUID: 'deboeck_device_uuid',
  COOKIE_NAME: 'deboeck_dev_id',
};

// In-memory cache for speed
let cachedProfile: DeviceProfile | null = null;
let cachedIp: string | null = null;

/**
 * Reads a cookie value by name
 */
function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  } catch {
    return null;
  }
}

/**
 * Sets a cookie with 1 year expiration
 */
function setCookie(name: string, value: string) {
  try {
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // Ignore cookie errors
  }
}

/**
 * Generates a random alphanumeric UUID
 */
function generateUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'dev_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }
  } catch {}
  return 'dev_' + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 10);
}

/**
 * Returns or creates a persistent device UUID stored in localStorage + Cookie.
 * This ID persists even if the student changes name or closes the tab.
 */
export function getDeviceId(): string {
  try {
    // 1. Try localStorage
    const local = localStorage.getItem(STORAGE_KEYS.DEVICE_UUID);
    if (local && local.startsWith('dev_')) {
      setCookie(STORAGE_KEYS.COOKIE_NAME, local);
      return local;
    }

    // 2. Try Cookie fallback
    const cookie = getCookie(STORAGE_KEYS.COOKIE_NAME);
    if (cookie && cookie.startsWith('dev_')) {
      localStorage.setItem(STORAGE_KEYS.DEVICE_UUID, cookie);
      return cookie;
    }

    // 3. Generate new UUID
    const newId = generateUuid();
    localStorage.setItem(STORAGE_KEYS.DEVICE_UUID, newId);
    setCookie(STORAGE_KEYS.COOKIE_NAME, newId);
    return newId;
  } catch {
    return generateUuid();
  }
}

/**
 * Quick hash function for hardware strings
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'fp_' + Math.abs(hash).toString(16);
}

/**
 * Computes a hardware fingerprint based on screen, GPU, cores, touch, timezone.
 * Resists Incognito mode because hardware features don't change in private tabs.
 */
export function getDeviceFingerprint(): string {
  try {
    const screenPart = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth || 24}`;
    const dpr = window.devicePixelRatio || 1;
    const touch = navigator.maxTouchPoints || 0;
    const cores = navigator.hardwareConcurrency || 0;
    const tz = Intl?.DateTimeFormat?.().resolvedOptions()?.timeZone || '';
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

    let gpuRenderer = '';
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
      }
    } catch {}

    const raw = `${screenPart}|${dpr}|${touch}|${cores}|${tz}|${platform}|${gpuRenderer}|${navigator.userAgent}`;
    return hashString(raw);
  } catch {
    return 'fp_unknown';
  }
}

/**
 * Produces a clear, human-readable description of the device:
 * e.g. "Android (Chrome) • 412x915" or "iPhone (Safari) • 393x852" or "Windows (Chrome) • 1920x1080"
 */
export function getDeviceInfo(): string {
  try {
    const ua = navigator.userAgent;
    let os = 'Dispositivo';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone/i.test(ua)) os = 'iPhone';
    else if (/iPad/i.test(ua)) os = 'iPad';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Navegador';
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';

    const resolution = `${window.screen.width}x${window.screen.height}`;
    return `${os} (${browser}) • ${resolution}`;
  } catch {
    return 'Dispositivo desconocido';
  }
}

/**
 * Asynchronously gets public IP via ipify with a strict timeout (2.5 s).
 * Never blocks execution or throws if offline/unreachable.
 */
export async function getPublicIp(): Promise<string> {
  if (cachedIp) return cachedIp;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedIp = String(data.ip).trim();
        return cachedIp;
      }
    }
  } catch {
    // Graceful fallback on network block, offline or adblocker
  }

  return 'IP no disponible';
}

/**
 * Returns full profile synchronously with best-effort IP (resolved in background).
 */
export async function getDeviceProfile(): Promise<DeviceProfile> {
  if (cachedProfile && cachedProfile.ip !== 'IP no disponible') {
    return cachedProfile;
  }

  const deviceId = getDeviceId();
  const fingerprint = getDeviceFingerprint();
  const deviceInfo = getDeviceInfo();
  const ip = await getPublicIp();

  cachedProfile = {
    deviceId,
    fingerprint,
    deviceInfo,
    ip,
  };

  return cachedProfile;
}

/**
 * Synchronous profile getter (using whatever IP is currently cached)
 */
export function getDeviceProfileSync(): DeviceProfile {
  return {
    deviceId: getDeviceId(),
    fingerprint: getDeviceFingerprint(),
    deviceInfo: getDeviceInfo(),
    ip: cachedIp || 'Obteniendo IP...',
  };
}

