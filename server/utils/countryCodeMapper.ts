/**
 * Country Code Mapper Utility
 * Converts country names to ISO 2-letter country codes
 * Lazy-populates the countries table when needed
 */

import { pool } from "../../db/index";

// Complete ISO 3166-1 alpha-2 country code mapping
export const COUNTRY_CODE_MAP: Record<string, string> = {
  // A
  "Afghanistan": "AF",
  "Albania": "AL",
  "Algeria": "DZ",
  "Andorra": "AD",
  "Angola": "AO",
  "Antigua and Barbuda": "AG",
  "Argentina": "AR",
  "Armenia": "AM",
  "Australia": "AU",
  "Austria": "AT",
  "Azerbaijan": "AZ",
  // B
  "Bahamas": "BS",
  "Bahrain": "BH",
  "Bangladesh": "BD",
  "Barbados": "BB",
  "Belarus": "BY",
  "Belgium": "BE",
  "Belize": "BZ",
  "Benin": "BJ",
  "Bhutan": "BT",
  "Bolivia": "BO",
  "Bosnia and Herzegovina": "BA",
  "Botswana": "BW",
  "Brazil": "BR",
  "Brunei": "BN",
  "Bulgaria": "BG",
  "Burkina Faso": "BF",
  "Burundi": "BI",
  // C
  "Cambodia": "KH",
  "Cameroon": "CM",
  "Canada": "CA",
  "Cape Verde": "CV",
  "Central African Republic": "CF",
  "Chad": "TD",
  "Chile": "CL",
  "China": "CN",
  "Colombia": "CO",
  "Comoros": "KM",
  "Congo": "CG",
  "Costa Rica": "CR",
  "Croatia": "HR",
  "Cuba": "CU",
  "Cyprus": "CY",
  "Czech Republic": "CZ",
  "Czechia": "CZ",
  // D
  "Denmark": "DK",
  "Djibouti": "DJ",
  "Dominica": "DM",
  "Dominican Republic": "DO",
  // E
  "East Timor": "TL",
  "Ecuador": "EC",
  "Egypt": "EG",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  "Eritrea": "ER",
  "Estonia": "EE",
  "Eswatini": "SZ",
  "Ethiopia": "ET",
  // F
  "Fiji": "FJ",
  "Finland": "FI",
  "France": "FR",
  // G
  "Gabon": "GA",
  "Gambia": "GM",
  "Georgia": "GE",
  "Germany": "DE",
  "Ghana": "GH",
  "Greece": "GR",
  "Grenada": "GD",
  "Guatemala": "GT",
  "Guinea": "GN",
  "Guinea-Bissau": "GW",
  "Guyana": "GY",
  // H
  "Haiti": "HT",
  "Honduras": "HN",
  "Hong Kong": "HK",
  "Hungary": "HU",
  // I
  "Iceland": "IS",
  "India": "IN",
  "Indonesia": "ID",
  "Iran": "IR",
  "Iraq": "IQ",
  "Ireland": "IE",
  "Israel": "IL",
  "Italy": "IT",
  "Ivory Coast": "CI",
  // J
  "Jamaica": "JM",
  "Japan": "JP",
  "Jordan": "JO",
  // K
  "Kazakhstan": "KZ",
  "Kenya": "KE",
  "Kiribati": "KI",
  "Kosovo": "XK",
  "Kuwait": "KW",
  "Kyrgyzstan": "KG",
  // L
  "Laos": "LA",
  "Latvia": "LV",
  "Lebanon": "LB",
  "Lesotho": "LS",
  "Liberia": "LR",
  "Libya": "LY",
  "Liechtenstein": "LI",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  // M
  "Macau": "MO",
  "Madagascar": "MG",
  "Malawi": "MW",
  "Malaysia": "MY",
  "Maldives": "MV",
  "Mali": "ML",
  "Malta": "MT",
  "Marshall Islands": "MH",
  "Mauritania": "MR",
  "Mauritius": "MU",
  "Mexico": "MX",
  "Micronesia": "FM",
  "Moldova": "MD",
  "Monaco": "MC",
  "Mongolia": "MN",
  "Montenegro": "ME",
  "Morocco": "MA",
  "Mozambique": "MZ",
  "Myanmar": "MM",
  // N
  "Namibia": "NA",
  "Nauru": "NR",
  "Nepal": "NP",
  "Netherlands": "NL",
  "New Zealand": "NZ",
  "Nicaragua": "NI",
  "Niger": "NE",
  "Nigeria": "NG",
  "North Korea": "KP",
  "North Macedonia": "MK",
  "Norway": "NO",
  // O
  "Oman": "OM",
  // P
  "Pakistan": "PK",
  "Palau": "PW",
  "Palestine": "PS",
  "Panama": "PA",
  "Papua New Guinea": "PG",
  "Paraguay": "PY",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  // Q
  "Qatar": "QA",
  // R
  "Romania": "RO",
  "Russia": "RU",
  "Russian Federation": "RU",
  "Rwanda": "RW",
  // S
  "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",
  "Samoa": "WS",
  "San Marino": "SM",
  "Sao Tome and Principe": "ST",
  "Saudi Arabia": "SA",
  "Senegal": "SN",
  "Serbia": "RS",
  "Seychelles": "SC",
  "Sierra Leone": "SL",
  "Singapore": "SG",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Solomon Islands": "SB",
  "Somalia": "SO",
  "South Africa": "ZA",
  "South Korea": "KR",
  "South Sudan": "SS",
  "Spain": "ES",
  "Sri Lanka": "LK",
  "Sudan": "SD",
  "Suriname": "SR",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Syria": "SY",
  // T
  "Taiwan": "TW",
  "Tajikistan": "TJ",
  "Tanzania": "TZ",
  "Thailand": "TH",
  "Timor-Leste": "TL",
  "Togo": "TG",
  "Tonga": "TO",
  "Trinidad and Tobago": "TT",
  "Tunisia": "TN",
  "Turkey": "TR",
  "Turkmenistan": "TM",
  "Tuvalu": "TV",
  // U
  "Uganda": "UG",
  "Ukraine": "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  "Uruguay": "UY",
  "Uzbekistan": "UZ",
  // V
  "Vanuatu": "VU",
  "Vatican City": "VA",
  "Venezuela": "VE",
  "Vietnam": "VN",
  // W
  "Wallis and Futuna": "WF",
  "Western Sahara": "EH",
  // Y
  "Yemen": "YE",
  // Z
  "Zambia": "ZM",
  "Zimbabwe": "ZW",
};

/**
 * Get ISO country code for a given country name
 * @param countryName - The country name to look up
 * @returns The 2-letter ISO country code, or null if not found
 */
export function getCountryCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  
  // Exact match first
  if (COUNTRY_CODE_MAP[countryName]) {
    return COUNTRY_CODE_MAP[countryName];
  }
  
  // Case-insensitive match
  const normalized = Object.keys(COUNTRY_CODE_MAP).find(
    key => key.toLowerCase() === countryName.toLowerCase()
  );
  
  return normalized ? COUNTRY_CODE_MAP[normalized] : null;
}

/**
 * Auto-populate country code in the database
 * Lazily updates the countries table when a new country code is needed
 * This is a non-blocking background operation
 */
export async function ensureCountryCode(
  countryName: string | null | undefined
): Promise<void> {
  if (!countryName) return;
  
  try {
    // Get the code for this country
    const code = getCountryCode(countryName);
    if (!code) {
      console.warn(`[Country Mapper] Unknown country: ${countryName}`);
      return;
    }
    
    // Check if this country already has a code in the database
    const result = await pool.query(
      `SELECT code FROM countries WHERE name = $1 LIMIT 1`,
      [countryName]
    );
    
    // If code is already set, skip
    if (result.rows.length > 0 && result.rows[0].code) {
      return;
    }
    
    // Update the country with the code (silently, no await needed)
    pool.query(
      `UPDATE countries SET code = $1 WHERE name = $2 AND code IS NULL`,
      [code, countryName]
    ).catch(err => {
      console.error(`[Country Mapper] Failed to update country code for ${countryName}:`, err.message);
    });
    
    console.log(`[Country Mapper] Auto-populated code for country: ${countryName} → ${code}`);
  } catch (error) {
    console.error("[Country Mapper] Error in ensureCountryCode:", error);
    // Fail silently - don't block detective operations
  }
}

/**
 * Batch ensure country codes for multiple countries
 * Useful when processing multiple detectives at once
 */
export async function ensureCountryCodesForDetectives(
  detectives: Array<{ country: string | null }>
): Promise<void> {
  const countries = new Set(
    detectives
      .map(d => d.country)
      .filter(Boolean) as string[]
  );
  
  // Fire off all promises without waiting
  Promise.all(
    Array.from(countries).map(country => ensureCountryCode(country))
  ).catch(err => {
    console.error("[Country Mapper] Batch error:", err);
  });
}
