// DNS client utility - handles the low-level DNS queries
import { APP_CONFIG } from '../config/app';
import { dnsRateLimiter, RateLimitError } from './rate-limiter';
import type { DnsResponse } from '../types/dns';

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('DNS query timed out. Please try again.');
    }
    throw error;
  }
};

export const queryDns = async (
  domain: string,
  type: string,
  endpoint: string
): Promise<DnsResponse> => {
  // Rate limiting check
  if (!dnsRateLimiter.canMakeQuery()) {
    const resetTimeMs = dnsRateLimiter.getResetTime();
    const resetSeconds = Math.ceil(resetTimeMs / 1000);
    throw new RateLimitError(
      `Rate limit exceeded. Please wait ${resetSeconds} seconds.`,
      resetTimeMs
    );
  }

  // Record the query
  dnsRateLimiter.recordQuery();

  const url = `${endpoint}?name=${domain}&type=${type}`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: 'application/dns-json',
      },
    },
    APP_CONFIG.DNS_TIMEOUT
  );

  if (!response.ok) {
    throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

