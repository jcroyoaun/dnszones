export interface DnsResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: DnsQuestion[];
  Answer?: DnsRecord[];
  Authority?: DnsRecord[];
}

export interface DnsQuestion {
  name: string;
  type: number;
}

export interface DnsRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface ZoneInfo {
  name: string;
  exists: boolean;
  soa?: {
    mname: string;
    rname: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
  };
  nameservers?: string[];
  ttl?: number;
}

export interface DetailedDnsRecords {
  soa?: DnsRecord & {
    parsed?: ZoneInfo['soa'];
  };
  ns?: DnsRecord[];
  a?: DnsRecord[];
  aaaa?: DnsRecord[];
  cname?: DnsRecord[];
  mx?: DnsRecord[];
  txt?: DnsRecord[];
}

export interface RdapResponse {
  domain?: string;
  registrar?: string;
  registrationDate?: string;
  expirationDate?: string;
  status?: string[];
  nameservers?: string[];
  error?: string;
}
