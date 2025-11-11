export interface DnsResolver {
  id: string;
  name: string;
  endpoint: string;
  color: string;
  description: string;
}

// Fallback endpoints if environment variables are not set
const CLOUDFLARE_ENDPOINT = import.meta.env.VITE_DOH_CLOUDFLARE_ENDPOINT || 'https://cloudflare-dns.com/dns-query';
const GOOGLE_ENDPOINT = import.meta.env.VITE_DOH_GOOGLE_ENDPOINT || 'https://dns.google/resolve';

export const RESOLVERS: DnsResolver[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    endpoint: CLOUDFLARE_ENDPOINT,
    color: '#F6821F',
    description: 'cloudflare-dns.com'
  },
  {
    id: 'google',
    name: 'Google',
    endpoint: GOOGLE_ENDPOINT,
    color: '#4285F4',
    description: 'dns.google'
  }
];

export const DEFAULT_RESOLVER = RESOLVERS[0];

export const getResolverById = (id: string): DnsResolver => {
  return RESOLVERS.find(r => r.id === id) || DEFAULT_RESOLVER;
};

