/** GST state codes, as used in GSTINs and place of supply. */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

export const GST_STATE_CODES = Object.keys(GST_STATES);

const STATE_NAME_ALIASES: Record<string, string> = {
  orissa: '21',
  pondicherry: '34',
  'nct of delhi': '07',
  'new delhi': '07',
  'daman and diu': '26',
  'dadra and nagar haveli': '26',
  'andaman & nicobar islands': '35',
  'jammu & kashmir': '01',
};

function normalizeStateName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const STATE_CODE_BY_NAME: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(GST_STATES).map(([code, name]) => [
      normalizeStateName(name),
      code,
    ]),
  ),
  ...STATE_NAME_ALIASES,
};

/** Map a free-text state name (e.g. a Google Places address) to its GST code. */
export function stateCodeFromName(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  return STATE_CODE_BY_NAME[normalizeStateName(name)] ?? null;
}

export function stateNameFromCode(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return GST_STATES[code] ?? null;
}
