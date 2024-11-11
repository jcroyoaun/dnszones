import { parsePublicSuffixList } from '../data/publicSuffixList';

let publicSuffixMap: Set<string> | null = null;

export function getPublicSuffixList(): Set<string> {
  if (!publicSuffixMap) {
    publicSuffixMap = parsePublicSuffixList();
  }
  return publicSuffixMap;
}
