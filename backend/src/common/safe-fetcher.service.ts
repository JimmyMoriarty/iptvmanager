// =====================================================
// SSRF-Safe HTTP Fetcher
// =====================================================
// This is the ONLY way the application fetches remote URLs.
// It blocks all private/internal IPs, dangerous protocols,
// and enforces size limits and timeouts.
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { URL } from 'url';
import * as dns from 'dns';
import * as net from 'net';

export interface FetchResult {
  ok: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  error?: string;
  responseTimeMs?: number;
  contentType?: string;
  contentLength?: number;
}

// Private/reserved IP ranges that MUST be blocked
const BLOCKED_IP_RANGES = [
  // Loopback
  { start: '127.0.0.0', end: '127.255.255.255' },
  // Private Class A
  { start: '10.0.0.0', end: '10.255.255.255' },
  // Private Class B
  { start: '172.16.0.0', end: '172.31.255.255' },
  // Private Class C
  { start: '192.168.0.0', end: '192.168.255.255' },
  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255' },
  // Multicast
  { start: '224.0.0.0', end: '239.255.255.255' },
  // Broadcast
  { start: '255.255.255.255', end: '255.255.255.255' },
  // CGNAT
  { start: '100.64.0.0', end: '100.127.255.255' },
  // Documentation
  { start: '192.0.2.0', end: '192.0.2.255' },
  { start: '198.51.100.0', end: '198.51.100.255' },
  { start: '203.0.113.0', end: '203.0.113.255' },
  // Null
  { start: '0.0.0.0', end: '0.255.255.255' },
];

const BLOCKED_IPV6_PREFIXES = [
  '::1',       // Loopback
  'fe80:',     // Link-local
  'fc00:',     // Unique local
  'fd00:',     // Unique local
  'ff00:',     // Multicast
  '::ffff:127.', // IPv4-mapped loopback
  '::ffff:10.',  // IPv4-mapped private
  '::ffff:172.16.', '::ffff:172.17.', '::ffff:172.18.', '::ffff:172.19.',
  '::ffff:172.20.', '::ffff:172.21.', '::ffff:172.22.', '::ffff:172.23.',
  '::ffff:172.24.', '::ffff:172.25.', '::ffff:172.26.', '::ffff:172.27.',
  '::ffff:172.28.', '::ffff:172.29.', '::ffff:172.30.', '::ffff:172.31.',
  '::ffff:192.168.',
  '::ffff:169.254.',
  '::ffff:0.',
];

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

@Injectable()
export class SafeFetcherService {
  private readonly logger = new Logger(SafeFetcherService.name);
  private readonly timeoutMs: number;
  private readonly maxSizeBytes: number;
  private readonly maxRedirects: number;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = this.config.get<number>('app.fetch.timeoutMs', 15000);
    this.maxSizeBytes = this.config.get<number>('app.fetch.maxSizeMb', 50) * 1024 * 1024;
    this.maxRedirects = this.config.get<number>('app.fetch.maxRedirects', 3);
  }

  /**
   * Validate a URL is safe to fetch (no SSRF)
   */
  async validateUrl(urlString: string): Promise<{ valid: boolean; error?: string }> {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    // Block dangerous protocols
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: `Blocked protocol: ${parsed.protocol}` };
    }

    // Block URLs with credentials
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URLs with credentials are blocked' };
    }

    // Resolve hostname to IP
    const hostname = parsed.hostname;

    // Block numeric IPs directly
    if (net.isIP(hostname)) {
      if (this.isBlockedIp(hostname)) {
        return { valid: false, error: 'Blocked IP address (private/reserved range)' };
      }
      return { valid: true };
    }

    // Block common dangerous hostnames
    const lowerHost = hostname.toLowerCase();
    const blockedHosts = [
      'localhost', 'localhost.localdomain', 'ip6-localhost',
      'metadata.google.internal', '169.254.169.254',
      'metadata.internal', 'kubernetes.default',
    ];
    if (blockedHosts.includes(lowerHost)) {
      return { valid: false, error: 'Blocked hostname' };
    }

    // DNS resolution check
    try {
      const addresses = await this.resolveDns(hostname);
      for (const addr of addresses) {
        if (this.isBlockedIp(addr)) {
          return { valid: false, error: `DNS resolves to blocked IP: ${addr}` };
        }
      }
    } catch {
      return { valid: false, error: 'DNS resolution failed' };
    }

    return { valid: true };
  }

  /**
   * Safely fetch a remote URL with SSRF protection
   */
  async fetch(urlString: string, options?: {
    method?: string;
    maxSize?: number;
    timeout?: number;
    headers?: Record<string, string>;
  }): Promise<FetchResult> {
    const startTime = Date.now();

    // Validate URL safety
    const validation = await this.validateUrl(urlString);
    if (!validation.valid) {
      this.logger.warn(`SSRF blocked: ${urlString} - ${validation.error}`);
      return { ok: false, error: `SSRF_BLOCKED: ${validation.error}` };
    }

    const method = options?.method || 'GET';
    const timeout = options?.timeout || this.timeoutMs;
    const maxSize = options?.maxSize || this.maxSizeBytes;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let redirectCount = 0;
      let currentUrl = urlString;

      // Manual redirect following with SSRF check on each hop
      const fetchOptions: RequestInit = {
        method,
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'IPTVManager/1.0 PlaylistFetcher',
          ...(options?.headers || {}),
        },
      };

      let response: Response;
      while (true) {
        response = await globalThis.fetch(currentUrl, fetchOptions);

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          redirectCount++;
          if (redirectCount > this.maxRedirects) {
            clearTimeout(timeoutId);
            return { ok: false, error: 'Too many redirects' };
          }

          const location = response.headers.get('location');
          if (!location) {
            clearTimeout(timeoutId);
            return { ok: false, error: 'Redirect without location header' };
          }

          // Resolve relative URLs
          currentUrl = new URL(location, currentUrl).toString();

          // SSRF check on redirect target
          const redirectValidation = await this.validateUrl(currentUrl);
          if (!redirectValidation.valid) {
            clearTimeout(timeoutId);
            this.logger.warn(`SSRF blocked redirect: ${currentUrl} - ${redirectValidation.error}`);
            return { ok: false, error: `SSRF_BLOCKED on redirect: ${redirectValidation.error}` };
          }

          continue;
        }

        break;
      }

      clearTimeout(timeoutId);

      // Check content length before reading body
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > maxSize) {
        return { ok: false, error: `Response too large: ${contentLength} bytes` };
      }

      // Read body with size limit enforcement
      const contentType = response.headers.get('content-type') || '';
      let body = '';

      if (method !== 'HEAD') {
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder('utf-8');
          let totalSize = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalSize += value.length;
            if (totalSize > maxSize) {
              reader.cancel();
              return { ok: false, error: `Response exceeded max size: ${maxSize} bytes` };
            }

            body += decoder.decode(value, { stream: true });
          }
        }
      }

      const responseTimeMs = Date.now() - startTime;
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        ok: response.ok,
        status: response.status,
        headers,
        body,
        contentType,
        contentLength: body.length,
        responseTimeMs,
      };
    } catch (err: unknown) {
      const error = err as Error;
      const responseTimeMs = Date.now() - startTime;

      if (error.name === 'AbortError') {
        return { ok: false, error: 'Request timed out', responseTimeMs };
      }

      this.logger.error(`Fetch error for ${urlString}: ${error.message}`);
      return { ok: false, error: error.message, responseTimeMs };
    }
  }

  /**
   * Lightweight HEAD request for health checking
   */
  async headCheck(urlString: string, timeoutMs?: number): Promise<FetchResult> {
    return this.fetch(urlString, {
      method: 'HEAD',
      timeout: timeoutMs || this.config.get<number>('app.healthCheck.timeoutMs', 10000),
    });
  }

  /**
   * Partial GET for health checking (reads first few KB)
   */
  async partialGet(urlString: string, maxBytes = 4096): Promise<FetchResult> {
    return this.fetch(urlString, {
      method: 'GET',
      maxSize: maxBytes,
      timeout: this.config.get<number>('app.healthCheck.timeoutMs', 10000),
      headers: { Range: `bytes=0-${maxBytes}` },
    });
  }

  // ---- Private helpers ----

  private ipToLong(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  private isBlockedIp(ip: string): boolean {
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      return BLOCKED_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix));
    }

    if (net.isIPv4(ip)) {
      const ipLong = this.ipToLong(ip);
      return BLOCKED_IP_RANGES.some(
        (range) => ipLong >= this.ipToLong(range.start) && ipLong <= this.ipToLong(range.end),
      );
    }

    return true; // Block anything we can't classify
  }

  private resolveDns(hostname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.resolve(hostname, (err, addresses) => {
        if (err) {
          // Fallback to dns.lookup
          dns.lookup(hostname, { all: true }, (err2, results) => {
            if (err2) reject(err2);
            else resolve(results.map((r) => r.address));
          });
        } else {
          resolve(addresses);
        }
      });
    });
  }
}
