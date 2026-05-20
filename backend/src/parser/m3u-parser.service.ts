// =====================================================
// M3U Parser Engine
// =====================================================
// Memory-efficient streaming parser for M3U playlists.
// Supports EXTM3U, EXTINF with all tvg-* attributes.
// Handles malformed playlists, UTF-8, and 100k+ channels.
// =====================================================

import { Injectable, Logger } from '@nestjs/common';

export interface ParsedChannel {
  name: string;
  streamUrl: string;
  groupTitle: string | null;
  tvgId: string | null;
  tvgName: string | null;
  tvgLogo: string | null;
  tvgCountry: string | null;
  tvgLanguage: string | null;
  duration: number;
  rawExtinf: string;
}

export interface ParseResult {
  channels: ParsedChannel[];
  totalParsed: number;
  errors: number;
  duplicatesRemoved: number;
  parseTimeMs: number;
}

@Injectable()
export class M3uParserService {
  private readonly logger = new Logger(M3uParserService.name);

  /**
   * Parse an M3U playlist string into structured channel data.
   * Handles malformed lines gracefully and deduplicates by stream URL.
   */
  parse(content: string, deduplicate = true): ParseResult {
    const startTime = Date.now();
    const channels: ParsedChannel[] = [];
    const seenUrls = new Set<string>();
    let errors = 0;
    let duplicatesRemoved = 0;

    // Normalize line endings
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    let currentExtinf: string | null = null;
    let lineIndex = 0;

    for (const rawLine of lines) {
      lineIndex++;
      const line = rawLine.trim();

      // Skip empty lines and comments (except EXTINF)
      if (!line || line === '#EXTM3U' || (line.startsWith('#') && !line.startsWith('#EXTINF'))) {
        // Check for #EXTM3U with attributes (EPG URL etc)
        continue;
      }

      // Parse EXTINF line
      if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
        continue;
      }

      // This should be a stream URL line
      if (currentExtinf && !line.startsWith('#')) {
        try {
          const channel = this.parseExtinfLine(currentExtinf, line);
          if (channel) {
            if (deduplicate) {
              const urlKey = channel.streamUrl.toLowerCase().trim();
              if (seenUrls.has(urlKey)) {
                duplicatesRemoved++;
                currentExtinf = null;
                continue;
              }
              seenUrls.add(urlKey);
            }
            channels.push(channel);
          } else {
            errors++;
          }
        } catch (err) {
          errors++;
          if (errors <= 10) {
            this.logger.debug(`Parse error at line ${lineIndex}: ${(err as Error).message}`);
          }
        }
        currentExtinf = null;
        continue;
      }

      // URL without EXTINF - create minimal channel
      if (!line.startsWith('#') && this.isValidUrl(line)) {
        const channel: ParsedChannel = {
          name: this.extractNameFromUrl(line),
          streamUrl: line,
          groupTitle: null,
          tvgId: null,
          tvgName: null,
          tvgLogo: null,
          tvgCountry: null,
          tvgLanguage: null,
          duration: -1,
          rawExtinf: '',
        };

        if (deduplicate) {
          const urlKey = channel.streamUrl.toLowerCase().trim();
          if (seenUrls.has(urlKey)) {
            duplicatesRemoved++;
            continue;
          }
          seenUrls.add(urlKey);
        }

        channels.push(channel);
      }
    }

    const parseTimeMs = Date.now() - startTime;

    this.logger.log(
      `Parsed ${channels.length} channels in ${parseTimeMs}ms ` +
      `(${errors} errors, ${duplicatesRemoved} duplicates removed)`,
    );

    return {
      channels,
      totalParsed: channels.length,
      errors,
      duplicatesRemoved,
      parseTimeMs,
    };
  }

  /**
   * Parse a single EXTINF line + URL into a ParsedChannel
   */
  private parseExtinfLine(extinfLine: string, url: string): ParsedChannel | null {
    if (!url || !this.isValidUrl(url)) {
      return null;
    }

    // Extract duration
    const durationMatch = extinfLine.match(/#EXTINF:\s*(-?\d+)/);
    const duration = durationMatch ? parseInt(durationMatch[1], 10) : -1;

    // Extract attributes using regex
    const tvgId = this.extractAttribute(extinfLine, 'tvg-id');
    const tvgName = this.extractAttribute(extinfLine, 'tvg-name');
    const tvgLogo = this.extractAttribute(extinfLine, 'tvg-logo');
    const groupTitle = this.extractAttribute(extinfLine, 'group-title');
    const tvgCountry = this.extractAttribute(extinfLine, 'tvg-country');
    const tvgLanguage = this.extractAttribute(extinfLine, 'tvg-language');

    // Extract channel name (everything after the last comma)
    let name = '';
    const commaIndex = extinfLine.lastIndexOf(',');
    if (commaIndex !== -1) {
      name = extinfLine.substring(commaIndex + 1).trim();
    }

    // Fallback name
    if (!name) {
      name = tvgName || tvgId || this.extractNameFromUrl(url);
    }

    return {
      name,
      streamUrl: url.trim(),
      groupTitle,
      tvgId,
      tvgName,
      tvgLogo,
      tvgCountry,
      tvgLanguage,
      duration,
      rawExtinf: extinfLine,
    };
  }

  /**
   * Extract a quoted attribute value from an EXTINF line.
   * Handles: tvg-id="value", tvg-name="value", etc.
   */
  private extractAttribute(line: string, attribute: string): string | null {
    // Match both single and double quotes
    const regex = new RegExp(`${attribute}="([^"]*)"`, 'i');
    const match = line.match(regex);
    if (match) return match[1].trim() || null;

    // Try single quotes
    const regexSingle = new RegExp(`${attribute}='([^']*)'`, 'i');
    const matchSingle = line.match(regexSingle);
    if (matchSingle) return matchSingle[1].trim() || null;

    return null;
  }

  /**
   * Basic URL validation
   */
  private isValidUrl(url: string): boolean {
    const trimmed = url.trim();
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('rtmp://') ||
      trimmed.startsWith('rtsp://') ||
      trimmed.startsWith('mms://') ||
      trimmed.startsWith('mmsh://') ||
      trimmed.startsWith('rtp://') ||
      trimmed.startsWith('udp://')
    );
  }

  /**
   * Extract a human-readable name from a URL
   */
  private extractNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const last = pathParts[pathParts.length - 1];
        return last.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      }
      return parsed.hostname;
    } catch {
      return 'Unknown Channel';
    }
  }

  /**
   * Generate M3U output string from channels
   */
  generateM3u(channels: ParsedChannel[], epgUrl?: string): string {
    const lines: string[] = [];

    // Header
    let header = '#EXTM3U';
    if (epgUrl) {
      header += ` url-tvg="${epgUrl}"`;
    }
    lines.push(header);

    for (const ch of channels) {
      // Build EXTINF line
      let extinf = `#EXTINF:${ch.duration}`;

      if (ch.tvgId) extinf += ` tvg-id="${ch.tvgId}"`;
      if (ch.tvgName) extinf += ` tvg-name="${ch.tvgName}"`;
      if (ch.tvgLogo) extinf += ` tvg-logo="${ch.tvgLogo}"`;
      if (ch.tvgCountry) extinf += ` tvg-country="${ch.tvgCountry}"`;
      if (ch.tvgLanguage) extinf += ` tvg-language="${ch.tvgLanguage}"`;
      if (ch.groupTitle) extinf += ` group-title="${ch.groupTitle}"`;

      extinf += `,${ch.name}`;
      lines.push(extinf);

      // Stream URL - ALWAYS the original URL, NEVER proxied
      lines.push(ch.streamUrl);
    }

    return lines.join('\n') + '\n';
  }
}
