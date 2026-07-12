// Full name → [lat, lon] coordinates
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [37.0902, -95.7129],
  "China": [35.8617, 104.1954],
  "Russia": [61.5240, 105.3188],
  "Brazil": [-14.2350, -51.9253],
  "India": [20.5937, 78.9629],
  "Germany": [51.1657, 10.4515],
  "United Kingdom": [55.3781, -3.4360],
  "France": [46.2276, 2.2137],
  "Japan": [36.2048, 138.2529],
  "Canada": [56.1304, -106.3468],
  "Australia": [-25.2744, 133.7751],
  "South Korea": [35.9078, 127.7669],
  "Netherlands": [52.1326, 5.2913],
  "Singapore": [1.3521, 103.8198],
  "Iran": [32.4279, 53.6880],
  "Nigeria": [9.0820, 8.6753],
  "Romania": [45.9432, 24.9668],
  "Ukraine": [48.3794, 31.1656],
  "Taiwan": [23.6978, 120.9605],
  "Vietnam": [14.0583, 108.2772],
  "Indonesia": [-0.7893, 113.9213],
  "Turkey": [38.9637, 35.2433],
  "Italy": [41.8719, 12.5674],
  "Spain": [40.4637, -3.7492],
  "Poland": [51.9194, 19.1451],
  "Mexico": [23.6345, -102.5528],
  "South Africa": [-30.5595, 22.9375],
  "Egypt": [26.8206, 30.8025],
  "Saudi Arabia": [23.8859, 45.0792],
  "Argentina": [-38.4161, -63.6167],
  "Colombia": [4.5709, -74.2973],
  "Pakistan": [30.3753, 69.3451],
  "Bangladesh": [23.6850, 90.3563],
  "Thailand": [15.8700, 100.9925],
  "Malaysia": [4.2105, 101.9758],
  "Philippines": [12.8797, 121.7740],
  "Sweden": [60.1282, 18.6435],
  "Switzerland": [46.8182, 8.2275],
  "Norway": [60.4720, 8.4689],
  "Finland": [61.9241, 25.7482],
  "Denmark": [56.2639, 9.5018],
  "Belgium": [50.5039, 4.4699],
  "Austria": [47.5162, 14.5501],
  "Czech Republic": [49.8175, 15.4730],
  "Hungary": [47.1625, 19.5033],
  "Portugal": [39.3999, -8.2245],
  "Greece": [39.0742, 21.8243],
  "Israel": [31.0461, 34.8516],
  "UAE": [23.4241, 53.8478],
  "United Arab Emirates": [23.4241, 53.8478],
  "Iraq": [33.2232, 43.6793],
  "Syria": [34.8021, 38.9968],
  "Morocco": [31.7917, -7.0926],
  "Algeria": [28.0339, 1.6596],
  "Tunisia": [33.8869, 9.5375],
  "Ethiopia": [9.1450, 40.4897],
  "Kenya": [-0.0236, 37.9062],
  "Ghana": [7.9465, -1.0232],
  "Tanzania": [-6.3690, 34.8888],
  "Venezuela": [6.4238, -66.5897],
  "Chile": [-35.6751, -71.5430],
  "Peru": [-9.1900, -75.0152],
  "New Zealand": [-40.9006, 174.8860],
  "Slovakia": [48.6690, 19.6990],
  "Bulgaria": [42.7339, 25.4858],
  "Serbia": [44.0165, 21.0059],
  "Croatia": [45.1000, 15.2000],
  "Lithuania": [55.1694, 23.8813],
  "Latvia": [56.8796, 24.6032],
  "Estonia": [58.5953, 25.0136],
  "Belarus": [53.7098, 27.9534],
  "Kazakhstan": [48.0196, 66.9237],
  "Uzbekistan": [41.3775, 64.5853],
  "Azerbaijan": [40.1431, 47.5769],
  "Georgia": [42.3154, 43.3569],
  "Armenia": [40.0691, 45.0382],
  "Jordan": [30.5852, 36.2384],
  "Kuwait": [29.3117, 47.4818],
  "Qatar": [25.3548, 51.1839],
  "Bahrain": [26.0275, 50.5500],
  "Oman": [21.5126, 55.9233],
  "Yemen": [15.5527, 48.5164],
  "Libya": [26.3351, 17.2283],
  "Sudan": [12.8628, 30.2176],
  "Cameroon": [7.3697, 12.3547],
  "Ivory Coast": [7.5400, -5.5471],
  "Angola": [-11.2027, 17.8739],
  "Mozambique": [-18.6657, 35.5296],
  "Zimbabwe": [-19.0154, 29.1549],
  "Zambia": [-13.1339, 27.8493],
  "Myanmar": [21.9162, 95.9560],
  "Sri Lanka": [7.8731, 80.7718],
  "Nepal": [28.3949, 84.1240],
  "Local": [20.0, 77.0],
  "Unknown": [0.0, 0.0],
};

// ISO 2-letter code → full country name
export const ISO2_TO_NAME: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AO: "Angola",
  AR: "Argentina", AM: "Armenia", AU: "Australia", AT: "Austria",
  AZ: "Azerbaijan", BH: "Bahrain", BD: "Bangladesh", BY: "Belarus",
  BE: "Belgium", BZ: "Belize", BJ: "Benin", BO: "Bolivia",
  BA: "Bosnia and Herzegovina", BW: "Botswana", BR: "Brazil",
  BG: "Bulgaria", KH: "Cambodia", CM: "Cameroon", CA: "Canada",
  CL: "Chile", CN: "China", CO: "Colombia", CD: "Congo",
  HR: "Croatia", CU: "Cuba", CY: "Cyprus", CZ: "Czech Republic",
  DK: "Denmark", DO: "Dominican Republic", EC: "Ecuador",
  EG: "Egypt", SV: "El Salvador", ET: "Ethiopia", FI: "Finland",
  FR: "France", GE: "Georgia", DE: "Germany", GH: "Ghana",
  GR: "Greece", GT: "Guatemala", HN: "Honduras", HU: "Hungary",
  IN: "India", ID: "Indonesia", IR: "Iran", IQ: "Iraq",
  IE: "Ireland", IL: "Israel", IT: "Italy", CI: "Ivory Coast",
  JM: "Jamaica", JP: "Japan", JO: "Jordan", KZ: "Kazakhstan",
  KE: "Kenya", KW: "Kuwait", KG: "Kyrgyzstan", LA: "Laos",
  LV: "Latvia", LB: "Lebanon", LY: "Libya", LT: "Lithuania",
  MK: "Macedonia", MY: "Malaysia", MV: "Maldives", ML: "Mali",
  MX: "Mexico", MD: "Moldova", MN: "Mongolia", MA: "Morocco",
  MZ: "Mozambique", MM: "Myanmar", NP: "Nepal", NL: "Netherlands",
  NZ: "New Zealand", NI: "Nicaragua", NG: "Nigeria", NO: "Norway",
  OM: "Oman", PK: "Pakistan", PA: "Panama", PY: "Paraguay",
  PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
  QA: "Qatar", RO: "Romania", RU: "Russia", SA: "Saudi Arabia",
  SN: "Senegal", RS: "Serbia", SL: "Sierra Leone", SG: "Singapore",
  SK: "Slovakia", SO: "Somalia", ZA: "South Africa", KR: "South Korea",
  ES: "Spain", LK: "Sri Lanka", SD: "Sudan", SE: "Sweden",
  CH: "Switzerland", SY: "Syria", TW: "Taiwan", TZ: "Tanzania",
  TH: "Thailand", TN: "Tunisia", TR: "Turkey", UG: "Uganda",
  UA: "Ukraine", AE: "United Arab Emirates", GB: "United Kingdom",
  US: "United States", UY: "Uruguay", UZ: "Uzbekistan",
  VE: "Venezuela", VN: "Vietnam", YE: "Yemen", ZM: "Zambia",
  ZW: "Zimbabwe",
};

// Target fallback location (San Francisco)
export const TARGET_COORDS: [number, number] = [37.7749, -122.4194];

/**
 * Resolve an ISO-2 code or full name to a [lat, lon] pair.
 */
export function getCountryCoords(countryName: string): [number, number] | null {
  if (!countryName) return null;

  // Check if it's a 2-letter ISO code first
  const upper = countryName.toUpperCase();
  if (upper.length === 2 && ISO2_TO_NAME[upper]) {
    const fullName = ISO2_TO_NAME[upper];
    if (COUNTRY_COORDS[fullName]) return COUNTRY_COORDS[fullName];
  }

  // Exact match on full name
  if (COUNTRY_COORDS[countryName]) return COUNTRY_COORDS[countryName];

  // Case-insensitive match
  const lower = countryName.toLowerCase();
  for (const [k, v] of Object.entries(COUNTRY_COORDS)) {
    if (k.toLowerCase() === lower) return v;
  }

  return null;
}

/**
 * Convert ISO-2 code to full country name.
 * Returns the input unchanged if no mapping is found.
 */
export function isoToFullName(code: string): string {
  if (!code) return code;
  const upper = code.toUpperCase();
  return ISO2_TO_NAME[upper] || code;
}
