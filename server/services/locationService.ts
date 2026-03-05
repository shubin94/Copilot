/**
 * LocationService - Centralized business logic for location data
 * 
 * Handles:
 * - Location normalization and matching (slug, name, code)
 * - Top locations aggregation with detective counts
 * - Country/state/city hierarchy management
 * - Caching strategies for location data
 */

import { db } from "../../db/index.js";
import { eq, and, or, desc, count, sql } from "drizzle-orm";
import {
  detectives,
  countries,
  states,
  cities,
} from "../../shared/schema.js";
import { Country, State, City } from "country-state-city";
import { generateSlug } from "../lib/slug-utils.js";
import * as cache from "../lib/cache.js";

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface CountryData {
  id: string;
  code: string;
  name: string;
  slug: string;
}

export interface StateData {
  id: string;
  countryId: string;
  name: string;
  slug: string;
}

export interface CityData {
  id: string;
  stateId: string;
  name: string;
  slug: string;
}

export interface TopLocationData {
  name: string;
  slug: string;
  countrySlug?: string;
  stateSlug?: string;
  detectiveCount: number;
}

export interface TopLocationsResult {
  countries: TopLocationData[];
  states: TopLocationData[];
  cities: TopLocationData[];
}

export interface ResolvedLocationIds {
  countryId: number | null;
  stateId: number | null;
  cityId: number | null;
}

// ========================================
// LOCATION ID RESOLUTION
// ========================================

/**
 * Resolve location text fields to their database IDs
 * 
 * IMPORTANT: ResolvedLocationIds permits nulls because this is a LOOKUP/RESOLUTION function
 * that may fail to find state or city. However, when these IDs are persisted in the
 * detectives table, the database schema enforces .notNull() on all these columns, so
 * null values cannot exist in stored data. This function's nullable return is for the
 * resolution process, not for what's actually stored.
 * 
 * @param country - Country name, code, or slug
 * @param state - State name (optional)
 * @param city - City name (optional)
 * @returns Object with countryId (always number), stateId and cityId (number | null if not found)
 * @throws Error if country is not found
 */
export async function resolveLocationIds(
  country: string,
  state?: string,
  city?: string
): Promise<ResolvedLocationIds> {
  // Resolve country ID (REQUIRED)
  const countryResult = await db
    .select({ id: countries.id })
    .from(countries)
    .where(
      or(
        eq(countries.code, country),
        eq(countries.name, country),
        eq(countries.slug, country),
        eq(countries.slug, generateSlug(country))
      )!
    )
    .limit(1);

  if (countryResult.length === 0) {
    throw new Error(`Country not found: ${country}. Please ensure the country exists in the database.`);
  }

  const countryId = countryResult[0].id;
  let stateId: number | null = null;
  let cityId: number | null = null;

  // Resolve state ID if provided
  if (state && state !== "Not specified" && state.trim()) {
    const stateResult = await db
      .select({ id: states.id })
      .from(states)
      .where(
        and(
          eq(states.countryId, countryId),
          or(
            eq(states.name, state),
            eq(states.slug, generateSlug(state)),
            sql`lower(trim(${states.name})) = lower(trim(${state}))`
          )!
        )
      )
      .limit(1);

    if (stateResult.length > 0) {
      stateId = stateResult[0].id;
    }
  }

  // Resolve city ID if provided (requires stateId)
  if (city && city !== "Not specified" && city.trim() && stateId !== null) {
    const cityResult = await db
      .select({ id: cities.id })
      .from(cities)
      .where(
        and(
          eq(cities.stateId, stateId),
          or(
            eq(cities.name, city),
            eq(cities.slug, generateSlug(city)),
            sql`lower(trim(${cities.name})) = lower(trim(${city}))`
          )!
        )
      )
      .limit(1);

    if (cityResult.length > 0) {
      cityId = cityResult[0].id;
    }
  }

  return {
    countryId,
    stateId,
    cityId,
  };
}

/**
 * Get default location IDs for fallback scenarios
 * Returns IDs for "Not specified" entries or first available location
 * Used when location resolution fails but detective creation must proceed
 */
export async function getDefaultLocationIds(): Promise<ResolvedLocationIds> {
  // Try to get US as default country
  const defaultCountryResult = await db
    .select({ id: countries.id })
    .from(countries)
    .where(eq(countries.code, "US"))
    .limit(1);

  if (defaultCountryResult.length === 0) {
    // If US not found, get any country as fallback
    const anyCountry = await db
      .select({ id: countries.id })
      .from(countries)
      .limit(1);

    if (anyCountry.length === 0) {
      throw new Error("No countries found in database. Please seed location data.");
    }

    return {
      countryId: anyCountry[0].id,
      stateId: null,
      cityId: null,
    };
  }

  const countryId = defaultCountryResult[0].id;

  // Try to get "Not specified" state for this country
  const defaultStateResult = await db
    .select({ id: states.id })
    .from(states)
    .where(
      and(
        eq(states.countryId, countryId),
        eq(states.name, "Not specified")
      )
    )
    .limit(1);

  const stateId = defaultStateResult.length > 0 ? defaultStateResult[0].id : null;

  // Try to get "Not specified" city for this state
  let cityId: number | null = null;
  if (stateId !== null) {
    const defaultCityResult = await db
      .select({ id: cities.id })
      .from(cities)
      .where(
        and(
          eq(cities.stateId, stateId),
          eq(cities.name, "Not specified")
        )
      )
      .limit(1);

    cityId = defaultCityResult.length > 0 ? defaultCityResult[0].id : null;
  }

  return {
    countryId,
    stateId,
    cityId,
  };
}

// ========================================
// LOCATION NORMALIZATION UTILITIES
// ========================================

/**
 * Build join condition for country matching
 * Matches on code, name, or slug (case-insensitive, trimmed)
 * This centralizes the country matching logic used across location queries
 */
export function buildCountryJoinCondition() {
  return or(
    eq(detectives.country, countries.code),
    eq(detectives.country, countries.name),
    eq(detectives.country, countries.slug)
  )!;
}

/**
 * @deprecated DO NOT USE - prevents index usage with SQL functions
 * 
 * PERFORMANCE CRITICAL: Applying upper(trim(...)) on both sides of a join condition
 * prevents PostgreSQL from using B-tree indexes, forcing full table scans.
 * 
 * Solution: Use FK-based joins (detectives.countryId = countries.id) instead.
 * If text matching is absolutely required, create functional indexes:
 *   CREATE INDEX idx_detectives_country_normalized ON detectives (upper(trim(country)));
 * 
 * Build SQL fragment for case-insensitive country matching
 * Used when we need raw SQL for complex joins
 */
export function buildCountryMatchSQL() {
  return sql`upper(trim(${detectives.country})) = upper(trim(${countries.code}))`;
}

/**
 * @deprecated DO NOT USE - prevents index usage with SQL functions
 * 
 * PERFORMANCE CRITICAL: Applying lower(trim(...)) prevents index usage.
 * Use FK-based joins (detectives.stateId = states.id) instead.
 * 
 * Build SQL fragment for case-insensitive state matching
 * Used when we need raw SQL for complex joins
 */
export function buildStateMatchSQL() {
  return sql`lower(trim(${detectives.state})) = lower(trim(${states.name}))`;
}

/**
 * @deprecated DO NOT USE - prevents index usage with SQL functions
 * 
 * PERFORMANCE CRITICAL: Applying lower(trim(...)) prevents index usage.
 * Use FK-based joins (detectives.cityId = cities.id) instead.
 * 
 * Build SQL fragment for case-insensitive city matching
 * Used when we need raw SQL for complex joins
 */
export function buildCityMatchSQL() {
  return sql`lower(trim(${detectives.city})) = lower(trim(${cities.name}))`;
}

// ========================================
// LOCATION HIERARCHY SERVICES
// ========================================

/**
 * Get all countries with slugs
 * Cached in memory for 24 hours
 */
export async function getAllCountries(): Promise<CountryData[]> {
  const cacheKey = "location:countries:all";
  
  // Check cache first
  try {
    const cached = cache.get<CountryData[]>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (_) {
    // Cache miss - continue
  }

  // Compute if not cached
  const allCountries = Country.getAllCountries()
    .map(c => ({
      id: c.isoCode,
      code: c.isoCode,
      name: c.name,
      slug: generateSlug(c.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Store in cache for 24 hours (86400 seconds)
  try {
    cache.set(cacheKey, allCountries, 86400);
  } catch (_) {
    // Cache failure must not break the request
  }
  
  return allCountries;
}

/**
 * Get states for a specific country
 * Cached in memory per country
 */
export async function getStatesForCountry(countryId: string): Promise<StateData[]> {
  const cacheKey = `location:states:${countryId}`;
  
  // Check cache first
  try {
    const cached = cache.get<StateData[]>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (_) {
    // Cache miss - continue
  }
  
  // Compute if not cached
  const countryStates = (State.getStatesOfCountry(countryId) || [])
    .map(s => ({
      id: s.isoCode,
      countryId: countryId,
      name: s.name,
      slug: generateSlug(s.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Store in cache for 24 hours
  try {
    cache.set(cacheKey, countryStates, 86400);
  } catch (_) {
    // Cache failure must not break the request
  }
  
  return countryStates;
}

/**
 * Get cities for a specific state
 * Cached in memory per state-country combination
 */
export async function getCitiesForState(countryId: string, stateId: string): Promise<CityData[]> {
  const cacheKey = `location:cities:${countryId}:${stateId}`;
  
  // Check cache first
  try {
    const cached = cache.get<CityData[]>(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (_) {
    // Cache miss - continue
  }

  // Compute if not cached
  const stateCities = (City.getCitiesOfState(countryId, stateId) || [])
    .map(c => ({
      id: c.name,
      stateId: stateId,
      name: c.name,
      slug: generateSlug(c.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Store in cache for 24 hours
  try {
    cache.set(cacheKey, stateCities, 86400);
  } catch (_) {
    // Cache failure must not break the request
  }
  
  return stateCities;
}

// ========================================
// TOP LOCATIONS AGGREGATION
// ========================================

/**
 * Get top locations with detective counts
 * Uses normalized FK references for accuracy and performance
 * 
 * RECOMMENDED: This is the preferred method for top locations aggregation as it uses
 * FK-based joins (stateId, cityId) which are indexed and perform significantly better
 * than text-based matching. Use this for all new implementations.
 * 
 * @param limitCountries - Max countries to return (default: 10, max: 50)
 * @param limitStates - Max states to return (default: 10, max: 50)
 * @param limitCities - Max cities to return (default: 10, max: 50)
 */
/**
 * Private helper: Core location aggregation logic
 * Consolidates ~130 lines of duplicate query code from getTopLocations and getTopLocationsForHomepage
 * 
 * @param limitCountries - Maximum countries to return (capped at 50)
 * @param limitStates - Maximum states to return (capped at 50)
 * @param limitCities - Maximum cities to return (capped at 50)
 * @param countryJoinCondition - Optional join condition for countries table (defaults to FK: detectives.countryId)
 *                               Can be `buildCountryJoinCondition()` for legacy fallback matching
 * @returns TopLocationsResult with aggregated countries, states, and cities by detective count
 */
async function aggregateTopLocations(
  limitCountries: number = 10,
  limitStates: number = 10,
  limitCities: number = 10,
  countryJoinCondition: any = undefined
): Promise<TopLocationsResult> {
  // Sanitize limits to prevent abuse
  const safeCountryLimit = Math.min(limitCountries || 10, 50);
  const safeStateLimit = Math.min(limitStates || 10, 50);
  const safeCityLimit = Math.min(limitCities || 10, 50);

  // Use provided join condition or default to FK-based join for performance
  const defaultCountryJoin = eq(detectives.countryId, countries.id);
  const actualCountryJoin = countryJoinCondition || defaultCountryJoin;

  // Aggregate countries with detective counts
  const topCountries = await db
    .select({
      name: countries.name,
      slug: countries.slug,
      detectiveCount: count(detectives.id),
    })
    .from(detectives)
    .innerJoin(countries, actualCountryJoin)
    .where(eq(detectives.status, "active"))
    .groupBy(countries.id, countries.name, countries.slug)
    .orderBy(desc(count(detectives.id)))
    .limit(safeCountryLimit);

  // Aggregate states with detective counts
  const topStates = await db
    .select({
      name: states.name,
      slug: states.slug,
      countrySlug: countries.slug,
      detectiveCount: count(detectives.id),
    })
    .from(detectives)
    .innerJoin(countries, actualCountryJoin)
    .innerJoin(
      states,
      and(
        eq(states.id, detectives.stateId),
        eq(states.countryId, countries.id)
      )
    )
    .where(eq(detectives.status, "active"))
    .groupBy(states.id, states.name, states.slug, countries.slug)
    .orderBy(desc(count(detectives.id)))
    .limit(safeStateLimit);

  // Aggregate cities with detective counts
  const topCities = await db
    .select({
      name: cities.name,
      slug: cities.slug,
      stateSlug: states.slug,
      countrySlug: countries.slug,
      detectiveCount: count(detectives.id),
    })
    .from(detectives)
    .innerJoin(countries, actualCountryJoin)
    .innerJoin(
      states,
      and(
        eq(states.id, detectives.stateId),
        eq(states.countryId, countries.id)
      )
    )
    .innerJoin(
      cities,
      and(
        eq(cities.id, detectives.cityId),
        eq(cities.stateId, states.id)
      )
    )
    .where(eq(detectives.status, "active"))
    .groupBy(cities.id, cities.name, cities.slug, states.slug, countries.slug)
    .orderBy(desc(count(detectives.id)))
    .limit(safeCityLimit);

  // Format response
  const countriesData = topCountries
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      detectiveCount: Number(row.detectiveCount) || 0,
    }))
    .filter((item) => item.detectiveCount > 0);

  const statesData = topStates
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      countrySlug: row.countrySlug,
      detectiveCount: Number(row.detectiveCount) || 0,
    }))
    .filter((item) => item.detectiveCount > 0);

  const citiesData = topCities
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      stateSlug: row.stateSlug,
      countrySlug: row.countrySlug,
      detectiveCount: Number(row.detectiveCount) || 0,
    }))
    .filter((item) => item.detectiveCount > 0);

  return {
    countries: countriesData,
    states: statesData,
    cities: citiesData,
  };
}

/**
 * @deprecated Use storage.getTopLocations() instead - this version uses text-based matching
 * 
 * PERFORMANCE WARNING: This implementation uses buildCountryJoinCondition() which matches
 * on text fields (detectives.country = countries.code/name/slug) instead of FK joins.
 * While it doesn't use SQL functions, the OR conditions still prevent optimal index usage.
 * 
 * RECOMMENDED: Use DatabaseStorage.getTopLocations() which uses FK-based joins:
 *   detectives.countryId = countries.id (indexed integer equality)
 * 
 * Get top locations with configurable limits
 * Supports legacy country matching via buildCountryJoinCondition() for text-based fallback
 * 
 * @param limitCountries - Maximum countries (default 10, capped at 50)
 * @param limitStates - Maximum states (default 10, capped at 50)
 * @param limitCities - Maximum cities (default 10, capped at 50)
 * @returns Top locations aggregated by detective count
 */
export async function getTopLocations(
  limitCountries: number = 10,
  limitStates: number = 10,
  limitCities: number = 10
): Promise<TopLocationsResult> {
  // Use legacy fallback join condition for text-based country matching
  const countryJoinCondition = buildCountryJoinCondition();
  
  return aggregateTopLocations(
    limitCountries,
    limitStates,
    limitCities,
    countryJoinCondition
  );
}

/**
 * Get top locations for homepage display
 * Uses FK-based joins for optimal query performance with indexed lookups
 * Fixed limits (8 each) optimized for homepage location grid layout
 * 
 * Performance: Direct ID equality checks (countryId, stateId, cityId) enable B-tree index
 * usage instead of full table scans. No function calls on join columns maintains sargability.
 * 
 * Data Safety: The detectives table schema enforces .notNull() on countryId, stateId, and
 * cityId columns, guaranteeing all persisted records have valid ID values. The innerJoin
 * will not exclude any valid records. Note: ResolvedLocationIds interface permits nulls
 * only during resolution/lookup, not for data already stored in the database.
 */
export async function getTopLocationsForHomepage(): Promise<TopLocationsResult> {
  // Fixed limits for homepage: 8 countries, 8 states, 8 cities
  // These match the homepage location grid layout expectations
  return aggregateTopLocations(8, 8, 8);
  // Omits countryJoinCondition parameter, uses default FK-based join for performance
}
