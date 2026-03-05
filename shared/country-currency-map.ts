// Server-safe country to currency mapping.
// Kept in shared/ so server code never imports client/src at runtime.

export interface CountryCurrencyMapping {
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
}

const COUNTRY_CURRENCY_MAP: Record<string, CountryCurrencyMapping> = {
  US: { countryCode: "US", currencyCode: "USD", currencySymbol: "$", currencyName: "US Dollar" },
  GB: { countryCode: "GB", currencyCode: "GBP", currencySymbol: "£", currencyName: "British Pound" },
  IN: { countryCode: "IN", currencyCode: "INR", currencySymbol: "₹", currencyName: "Indian Rupee" },
  CA: { countryCode: "CA", currencyCode: "CAD", currencySymbol: "C$", currencyName: "Canadian Dollar" },
  AU: { countryCode: "AU", currencyCode: "AUD", currencySymbol: "A$", currencyName: "Australian Dollar" },

  DE: { countryCode: "DE", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  FR: { countryCode: "FR", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  IT: { countryCode: "IT", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  ES: { countryCode: "ES", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  IE: { countryCode: "IE", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  NL: { countryCode: "NL", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  BE: { countryCode: "BE", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  AT: { countryCode: "AT", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  PT: { countryCode: "PT", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },
  FI: { countryCode: "FI", currencyCode: "EUR", currencySymbol: "€", currencyName: "Euro" },

  SG: { countryCode: "SG", currencyCode: "SGD", currencySymbol: "S$", currencyName: "Singapore Dollar" },
  HK: { countryCode: "HK", currencyCode: "HKD", currencySymbol: "HK$", currencyName: "Hong Kong Dollar" },
  JP: { countryCode: "JP", currencyCode: "JPY", currencySymbol: "¥", currencyName: "Japanese Yen" },
  CN: { countryCode: "CN", currencyCode: "CNY", currencySymbol: "¥", currencyName: "Chinese Yuan" },
  AE: { countryCode: "AE", currencyCode: "AED", currencySymbol: "AED", currencyName: "UAE Dirham" },
  SA: { countryCode: "SA", currencyCode: "SAR", currencySymbol: "SAR", currencyName: "Saudi Riyal" },
  ZA: { countryCode: "ZA", currencyCode: "ZAR", currencySymbol: "R", currencyName: "South African Rand" },
  BR: { countryCode: "BR", currencyCode: "BRL", currencySymbol: "R$", currencyName: "Brazilian Real" },
  MX: { countryCode: "MX", currencyCode: "MXN", currencySymbol: "Mex$", currencyName: "Mexican Peso" },
};

export const SUPPORTED_CURRENCIES = ["USD", "GBP", "INR", "CAD", "AUD", "EUR"] as const;

export function getCurrencyForCountry(countryCode: string): CountryCurrencyMapping {
  const code = (countryCode || "US").toUpperCase();
  const mapping = COUNTRY_CURRENCY_MAP[code];

  if (mapping) {
    return mapping;
  }

  return {
    countryCode: code,
    currencyCode: "USD",
    currencySymbol: "$",
    currencyName: "US Dollar",
  };
}

export function isCurrencySupported(currencyCode: string): boolean {
  return SUPPORTED_CURRENCIES.includes((currencyCode || "").toUpperCase() as (typeof SUPPORTED_CURRENCIES)[number]);
}

export function getEffectiveCurrency(countryCurrencyCode: string): string {
  const normalized = (countryCurrencyCode || "").toUpperCase();
  return isCurrencySupported(normalized) ? normalized : "USD";
}
