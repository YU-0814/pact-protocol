// Common abbreviation map
const COMMON_ABBREVS: Record<string, string> = {
  name: 'n', price: 'p', description: 'desc', title: 't',
  image: 'img', url: 'url', rating: 'r', reviews: 'rv',
  address: 'addr', phone: 'ph', latitude: 'lat', longitude: 'lng',
  currency: 'cur', category: 'cat', brand: 'brand', email: 'em',
  date: 'dt', time: 'tm', status: 'st', type: 'typ',
  summary: 'sum', author: 'auth', source: 'src', language: 'lang',
  duration: 'dur', published: 'pub', updated: 'upd', created: 'crt',
  location: 'loc', country: 'ctry', city: 'city', state: 'state',
  weight: 'wt', height: 'ht', width: 'wd', color: 'clr',
  size: 'sz', quantity: 'qty', available: 'avail', stock: 'stk',
  shipping: 's', discount: 'disc', merchant: 'm', provider: 'prov',
  instructor: 'inst', company: 'co', salary: 'sal', remote: 'rem',
  amenities: 'amen', cuisine: 'cui', delivery: 'dlv', hours: 'hrs',
  bedrooms: 'bed', bathrooms: 'bath', area: 'area', agent: 'agt',
};

export function abbreviate(fullName: string, existing: Set<string>): string {
  // 1. Check common map
  const lower = fullName.toLowerCase();
  if (COMMON_ABBREVS[lower] && !existing.has(COMMON_ABBREVS[lower])) {
    return COMMON_ABBREVS[lower];
  }

  // 2. Try first 3 chars, then 4 chars
  for (let len = 3; len <= Math.min(fullName.length, 6); len++) {
    const candidate = fullName.slice(0, len).toLowerCase();
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  // 3. Append number if collision
  const base = fullName.slice(0, 3).toLowerCase();
  let counter = 2;
  while (existing.has(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}

export function abbreviateAll(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const existing = new Set<string>();

  for (const field of fields) {
    const abbrev = abbreviate(field, existing);
    result[field] = abbrev;
    existing.add(abbrev);
  }

  return result;
}
