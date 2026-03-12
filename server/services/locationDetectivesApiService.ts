import { getLocationDetectivesForSEO } from "../lib/seo-injection.js";

const LOCATION_SLUG_PATTERN = /^[a-z0-9-]{1,100}$/;
const LOCATION_QUERY_TIMEOUT_MS = 20000;

export interface LocationSlugParams {
  countrySlug: string;
  stateSlug?: string;
  citySlug?: string;
}

export interface LocationValidationError {
  error: string;
  code: string;
  message: string;
}

export interface LocationPagination {
  limit: number;
  offset: number;
}

type LocationSeoResult = Awaited<ReturnType<typeof getLocationDetectivesForSEO>>;

export interface LocationDetectivePageResult {
  detectives: LocationSeoResult["detectives"];
  location: LocationSeoResult["location"];
  hasMore: boolean;
  estimatedTotal: number;
}

export function validateLocationSlugParams(params: LocationSlugParams): LocationValidationError | null {
  const { countrySlug, stateSlug, citySlug } = params;

  if (!LOCATION_SLUG_PATTERN.test(countrySlug)) {
    return {
      error: "Invalid country slug format",
      code: "INVALID_COUNTRY_SLUG",
      message: "Country slug must contain only lowercase letters, numbers, and hyphens",
    };
  }

  if (stateSlug && !LOCATION_SLUG_PATTERN.test(stateSlug)) {
    return {
      error: "Invalid state slug format",
      code: "INVALID_STATE_SLUG",
      message: "State slug must contain only lowercase letters, numbers, and hyphens",
    };
  }

  if (citySlug && !LOCATION_SLUG_PATTERN.test(citySlug)) {
    return {
      error: "Invalid city slug format",
      code: "INVALID_CITY_SLUG",
      message: "City slug must contain only lowercase letters, numbers, and hyphens",
    };
  }

  return null;
}

export function parseLocationPagination(limitRaw: unknown, offsetRaw: unknown): LocationPagination {
  const parsedLimit = Number(limitRaw);
  const parsedOffset = Number(offsetRaw);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(30, Math.floor(parsedLimit))) : 15,
    offset: Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0,
  };
}

export async function fetchLocationDetectivesPage(
  params: LocationSlugParams & LocationPagination,
): Promise<LocationDetectivePageResult> {
  const { countrySlug, stateSlug, citySlug, limit, offset } = params;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("LOCATION_QUERY_TIMEOUT")), LOCATION_QUERY_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      getLocationDetectivesForSEO(countrySlug, stateSlug, citySlug, limit, offset),
      timeoutPromise,
    ]);
    const detectives = result.detectives;
    const hasMore = result.hasMore;
    const estimatedTotal = hasMore ? offset + detectives.length + 1 : offset + detectives.length;

    return {
      detectives,
      location: result.location,
      hasMore,
      estimatedTotal,
    };
  } finally {
    if (typeof timeoutId !== "undefined") {
      clearTimeout(timeoutId);
    }
  }
}
