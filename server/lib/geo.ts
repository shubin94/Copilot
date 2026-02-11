/**
 * Server-side geo: city -> state -> country for Smart AI search location resolution.
 * Uses authoritative country-state-city library instead of hardcoded data.
 */

import { Country, State, City } from "country-state-city";

export const COUNTRY_CODES = ["US", "GB", "IN", "CA", "AU", "DE", "FR"] as const;

// Build maps from library data for resolveLocation function
function buildCityMap(): Map<string, CityStateCountry> {
  const cityToStateCountry = new Map<string, CityStateCountry>();

  const countries = Country.getAllCountries();
  for (const country of countries) {
    const countryCode = country.isoCode;
    const states = State.getStatesOfCountry(countryCode);

    for (const state of states) {
      // Add state mappings
      const stateKey = normalizeForMatch(state.name);
      if (!cityToStateCountry.has(stateKey)) {
        cityToStateCountry.set(stateKey, { state: state.name, country: countryCode });
      }

      // Add city mappings
      const cities = City.getCitiesOfState(countryCode, state.isoCode);
      for (const city of cities) {
        const cityKey = normalizeForMatch(city.name);
        if (!cityToStateCountry.has(cityKey)) {
          cityToStateCountry.set(cityKey, { city: city.name, state: state.name, country: countryCode });
        }
      }
    }
  }

  return cityToStateCountry;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export interface CityStateCountry {
  city?: string;
  state: string;
  country: string;
}

const cityToStateCountry = buildCityMap();

/** Resolve a location string (e.g. "Mumbai", "Karnataka", "US") to city/state/country. */
export function resolveLocation(query: string): { city?: string; state: string; country: string } | null {
  const q = normalizeForMatch(query);
  if (!q) return null;

  const byCity = cityToStateCountry.get(q);
  if (byCity) return byCity;

  // Fuzzy match
  for (const [key, val] of cityToStateCountry) {
    if (q.includes(key) || key.includes(q)) return val;
  }

  // Check if it's a country code
  const upper = query.trim().toUpperCase();
  if (COUNTRY_CODES.includes(upper as any)) {
    const states = State.getStatesOfCountry(upper);
    const state = states[0];
    return state ? { state: state.name, country: upper } : { state: "", country: upper };
  }

  // Check all countries/states for exact match
  const countries = Country.getAllCountries();
  for (const country of countries) {
    const states = State.getStatesOfCountry(country.isoCode);
    for (const state of states) {
      if (normalizeForMatch(state.name) === q) {
        return { state: state.name, country: country.isoCode };
      }
    }
  }

  return null;
}
