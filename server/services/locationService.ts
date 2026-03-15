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

function normalizeText(input?: string): string {
  return (input || "").trim();
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeCountryCode(input: string): string {
  const trimmed = normalizeText(input);
  return trimmed.length <= 3 ? trimmed.toUpperCase() : trimmed.slice(0, 3).toUpperCase();
}

function normalizeCountryName(input: string): string {
  return toTitleCase(normalizeText(input));
}

function normalizeStateName(input: string, countryCode?: string): string {
  const trimmed = normalizeText(input);
  if (!trimmed) return "Not specified";

  // Handle ISO-like state codes (e.g. AZ -> Arizona)
  const codeLike = trimmed.toUpperCase();
  if (codeLike.length <= 3 && countryCode) {
    const lookup = (State.getStatesOfCountry(countryCode.toUpperCase()) || [])
      .find((s) => s.isoCode.toUpperCase() === codeLike);
    if (lookup?.name) {
      return lookup.name;
    }
  }

  return toTitleCase(trimmed);
}

function normalizeCityName(input?: string): string {
  const trimmed = normalizeText(input);
  if (!trimmed) return "Not specified";
  return toTitleCase(trimmed);
}

async function upsertCountry(nameOrCode: string): Promise<number> {
  const raw = normalizeText(nameOrCode);
  const slug = generateSlug(raw);
  const upperCode = normalizeCountryCode(raw);

  const catalogCountry = Country.getAllCountries().find((c) =>
    c.isoCode.toUpperCase() === upperCode ||
    c.name.toLowerCase() === raw.toLowerCase() ||
    generateSlug(c.name) === slug
  );

  const countryCode = catalogCountry?.isoCode || upperCode;
  const countryName = catalogCountry?.name || normalizeCountryName(raw);
  const countrySlug = generateSlug(countryName);

  const existing = await db
    .select({ id: countries.id })
    .from(countries)
    .where(
      or(
        sql`lower(${countries.code}) = lower(${countryCode})`,
        sql`lower(trim(${countries.name})) = lower(trim(${countryName}))`,
        sql`lower(${countries.slug}) = lower(${countrySlug})`
      )!
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const inserted = await db.execute(sql`
    INSERT INTO countries (code, name, slug)
    VALUES (${countryCode}, ${countryName}, ${countrySlug})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code
    RETURNING id
  `);

  const insertedId = Number((inserted as any).rows?.[0]?.id);
  if (Number.isFinite(insertedId) && insertedId > 0) {
    return insertedId;
  }

  const fallback = await db
    .select({ id: countries.id })
    .from(countries)
    .where(eq(countries.slug, countrySlug))
    .limit(1);

  if (fallback.length === 0) {
    throw new Error(`Failed to upsert country: ${countryName}`);
  }

  return fallback[0].id;
}

async function upsertState(countryId: number, stateNameInput: string, countryCode?: string): Promise<number> {
  const normalizedStateName = normalizeStateName(stateNameInput, countryCode);
  const stateSlug = generateSlug(normalizedStateName);

  const existing = await db
    .select({ id: states.id })
    .from(states)
    .where(
      and(
        eq(states.countryId, countryId),
        or(
          sql`lower(trim(${states.name})) = lower(trim(${normalizedStateName}))`,
          sql`lower(${states.slug}) = lower(${stateSlug})`
        )!
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const inserted = await db.execute(sql`
    INSERT INTO states (country_id, name, slug)
    VALUES (${countryId}, ${normalizedStateName}, ${stateSlug})
    ON CONFLICT (country_id, slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);

  const insertedId = Number((inserted as any).rows?.[0]?.id);
  if (Number.isFinite(insertedId) && insertedId > 0) {
    return insertedId;
  }

  const fallback = await db
    .select({ id: states.id })
    .from(states)
    .where(and(eq(states.countryId, countryId), eq(states.slug, stateSlug)))
    .limit(1);

  if (fallback.length === 0) {
    throw new Error(`Failed to upsert state: ${normalizedStateName}`);
  }

  return fallback[0].id;
}

async function upsertCity(stateId: number, cityNameInput?: string): Promise<number> {
  const normalizedCityName = normalizeCityName(cityNameInput);
  const citySlug = generateSlug(normalizedCityName);

  const existing = await db
    .select({ id: cities.id })
    .from(cities)
    .where(
      and(
        eq(cities.stateId, stateId),
        or(
          sql`lower(trim(${cities.name})) = lower(trim(${normalizedCityName}))`,
          sql`lower(${cities.slug}) = lower(${citySlug})`
        )!
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const inserted = await db.execute(sql`
    INSERT INTO cities (state_id, name, slug)
    VALUES (${stateId}, ${normalizedCityName}, ${citySlug})
    ON CONFLICT (state_id, slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);

  const insertedId = Number((inserted as any).rows?.[0]?.id);
  if (Number.isFinite(insertedId) && insertedId > 0) {
    return insertedId;
  }

  const fallback = await db
    .select({ id: cities.id })
    .from(cities)
    .where(and(eq(cities.stateId, stateId), eq(cities.slug, citySlug)))
    .limit(1);

  if (fallback.length === 0) {
    throw new Error(`Failed to upsert city: ${normalizedCityName}`);
  }

  return fallback[0].id;
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
  const normalizedCountryInput = normalizeText(country) || "US";
  const countryCode = normalizeCountryCode(normalizedCountryInput);

  // Permanent behavior: ensure hierarchy exists and always return IDs.
  const countryId = await upsertCountry(normalizedCountryInput);
  const stateId = await upsertState(countryId, normalizeText(state) || "Not specified", countryCode);
  const cityId = await upsertCity(stateId, normalizeText(city) || "Not specified");

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
  const countryId = await upsertCountry("US");
  const stateId = await upsertState(countryId, "Not specified", "US");
  const cityId = await upsertCity(stateId, "Not specified");

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
