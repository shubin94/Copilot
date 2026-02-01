/**
 * Server-side geo: city -> state -> country for Smart AI search location resolution.
 * Used only for availability cascade (city → state → country). Does not query DB.
 */

export const COUNTRY_CODES = ["US", "UK", "IN", "CA", "AU", "DE", "FR"] as const;

// State names per country (subset matching client geo for consistency)
export const COUNTRY_STATES: Record<string, string[]> = {
  US: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"],
  UK: ["England", "Scotland", "Wales", "Northern Ireland"],
  IN: ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh"],
  CA: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan"],
  AU: ["New South Wales", "Queensland", "South Australia", "Tasmania", "Victoria", "Western Australia", "Australian Capital Territory", "Northern Territory"],
  DE: ["Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"],
  FR: ["Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Hauts-de-France", "Nouvelle-Aquitaine", "Occitanie", "Normandy", "Brittany", "Centre-Val de Loire", "Bourgogne-Franche-Comté", "Grand Est", "Pays de la Loire", "Corsica"],
};

// State -> cities (subset for lookup)
const STATE_CITIES: Record<string, string[]> = {
  "California": ["Los Angeles", "San Francisco", "San Diego", "Sacramento"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik"],
  "Karnataka": ["Bangalore", "Mysore", "Mangalore", "Belgaum"],
  "Texas": ["Houston", "Dallas", "Austin", "San Antonio"],
  "Florida": ["Jacksonville", "Miami", "Tampa", "Orlando"],
  "New York": ["New York City", "Buffalo", "Rochester"],
  "Washington": ["Seattle", "Tacoma", "Vancouver"],
  "Illinois": ["Chicago", "Aurora", "Rockford"],
  "Ontario": ["Toronto", "Ottawa", "Hamilton", "London"],
  "Quebec": ["Montreal", "Quebec City", "Gatineau"],
  "British Columbia": ["Vancouver", "Victoria", "Surrey"],
  "England": ["London", "Manchester", "Birmingham", "Leeds"],
  "Scotland": ["Edinburgh", "Glasgow", "Aberdeen"],
  "New South Wales": ["Sydney", "Newcastle", "Wollongong"],
  "Victoria": ["Melbourne", "Geelong", "Ballarat"],
  "Bavaria": ["Munich", "Nuremberg", "Augsburg"],
  "Berlin": ["Berlin"],
  "Île-de-France": ["Paris", "Versailles"],
  "Delhi": ["New Delhi", "Delhi Cantonment"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"],
  "West Bengal": ["Kolkata", "Darjeeling", "Siliguri"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Noida"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
};

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export interface CityStateCountry {
  city?: string;
  state: string;
  country: string;
}

const cityToStateCountry: Map<string, CityStateCountry> = new Map();

function buildCityMap(): void {
  if (cityToStateCountry.size > 0) return;
  for (const [country, states] of Object.entries(COUNTRY_STATES)) {
    for (const state of states) {
      const cities = STATE_CITIES[state];
      if (cities) {
        for (const city of cities) {
          const key = normalizeForMatch(city);
          if (!cityToStateCountry.has(key)) {
            cityToStateCountry.set(key, { city, state, country });
          }
        }
      }
      const stateKey = normalizeForMatch(state);
      if (!cityToStateCountry.has(stateKey)) {
        cityToStateCountry.set(stateKey, { state, country });
      }
    }
  }
}

buildCityMap();

/** Resolve a location string (e.g. "Mumbai", "Karnataka", "IN") to city/state/country. */
export function resolveLocation(query: string): { city?: string; state: string; country: string } | null {
  const q = normalizeForMatch(query);
  if (!q) return null;
  const byCity = cityToStateCountry.get(q);
  if (byCity) return byCity;
  for (const [key, val] of cityToStateCountry) {
    if (q.includes(key) || key.includes(q)) return val;
  }
  const upper = query.trim().toUpperCase();
  if (COUNTRY_CODES.includes(upper as any)) {
    const states = COUNTRY_STATES[upper];
    const state = states?.[0];
    return state ? { state, country: upper } : { state: "", country: upper };
  }
  for (const country of Object.keys(COUNTRY_STATES)) {
    const states = COUNTRY_STATES[country];
    for (const state of states) {
      if (normalizeForMatch(state) === q) return { state, country };
    }
  }
  return null;
}
