import { and, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { cities, countries, states } from "../../shared/schema.js";

export interface ResolvedLocationHierarchyForSeo {
  countryId: number | null;
  countryName?: string;
  stateId?: number;
  stateName?: string;
  cityId?: number;
  cityName?: string;
  stateResolved: boolean;
  cityResolved: boolean;
  fallbackLevel: "none" | "country" | "state";
  locationFound: boolean;
}

const LOCATION_HIERARCHY_CACHE_TTL_MS = 2 * 60 * 1000;
const locationHierarchyCache = new Map<string, { value: ResolvedLocationHierarchyForSeo; expiresAt: number }>();

function getCacheKey(
  countrySlugParam: string,
  stateSlugParam: string | undefined,
  citySlugParam: string | undefined,
  allowParentFallback: boolean,
): string {
  return `${countrySlugParam}|${stateSlugParam || ""}|${citySlugParam || ""}|${allowParentFallback ? "1" : "0"}`;
}

function getCachedLocationHierarchy(cacheKey: string): ResolvedLocationHierarchyForSeo | null {
  const cached = locationHierarchyCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    locationHierarchyCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedLocationHierarchy(cacheKey: string, value: ResolvedLocationHierarchyForSeo): void {
  locationHierarchyCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + LOCATION_HIERARCHY_CACHE_TTL_MS,
  });
}

export async function resolveLocationHierarchyForSeo(
  countrySlugParam: string,
  stateSlugParam: string | undefined,
  citySlugParam: string | undefined,
  allowParentFallback: boolean,
): Promise<ResolvedLocationHierarchyForSeo> {
  const cacheKey = getCacheKey(countrySlugParam, stateSlugParam, citySlugParam, allowParentFallback);
  const cached = getCachedLocationHierarchy(cacheKey);
  if (cached) return cached;

  const countryRows = await db
    .select({ id: countries.id, name: countries.name })
    .from(countries)
    .where(eq(countries.slug, countrySlugParam))
    .limit(1);

  const countryId = countryRows[0]?.id ?? null;
  const countryName = countryRows[0]?.name;
  if (!countryId) {
    const result = {
      countryId: null,
      countryName,
      stateResolved: !stateSlugParam,
      cityResolved: !citySlugParam,
      fallbackLevel: "none",
      locationFound: false,
    };
    setCachedLocationHierarchy(cacheKey, result);
    return result;
  }

  let stateId: number | undefined;
  let stateName: string | undefined;
  let stateResolved = !stateSlugParam;
  let fallbackLevel: "none" | "country" | "state" = "none";

  if (stateSlugParam) {
    const stateRows = await db
      .select({ id: states.id, name: states.name })
      .from(states)
      .where(and(eq(states.countryId, countryId), eq(states.slug, stateSlugParam)))
      .limit(1);
    stateId = stateRows[0]?.id;
    stateName = stateRows[0]?.name;

    if (!stateId) {
      stateResolved = false;
      if (!allowParentFallback) {
        const result = {
          countryId,
          countryName,
          stateResolved,
          cityResolved: !citySlugParam,
          fallbackLevel: "none",
          locationFound: false,
        };
        setCachedLocationHierarchy(cacheKey, result);
        return result;
      }
      fallbackLevel = "country";
    }
  }

  let cityId: number | undefined;
  let cityName: string | undefined;
  let cityResolved = !citySlugParam;

  if (citySlugParam && stateId) {
    const cityRows = await db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .where(and(eq(cities.stateId, stateId), eq(cities.slug, citySlugParam)))
      .limit(1);
    cityId = cityRows[0]?.id;
    cityName = cityRows[0]?.name;

    if (!cityId) {
      cityResolved = false;
      if (!allowParentFallback) {
        const result = {
          countryId,
          countryName,
          stateId,
          stateName,
          stateResolved,
          cityResolved,
          fallbackLevel: "none",
          locationFound: false,
        };
        setCachedLocationHierarchy(cacheKey, result);
        return result;
      }
      if (fallbackLevel !== "country") {
        fallbackLevel = "state";
      }
    }
  } else if (citySlugParam) {
    cityResolved = false;
    fallbackLevel = "country";
  }

  const result = {
    countryId,
    countryName,
    stateId,
    stateName,
    cityId,
    cityName,
    stateResolved,
    cityResolved,
    fallbackLevel,
    locationFound: true,
  };
  setCachedLocationHierarchy(cacheKey, result);
  return result;
}
