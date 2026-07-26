/**
 * Host resolution. Injectable so tests can stub it (e.g. to simulate a
 * DNS-rebinding attacker that returns different addresses on successive calls).
 *
 * The default uses getaddrinfo via dns.promises.lookup with `all: true` so we
 * see every A and AAAA record and can validate each one before connecting.
 */

import { promises as dnsPromises } from "node:dns";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const defaultResolver: HostResolver = async (hostname) => {
  const results = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};
