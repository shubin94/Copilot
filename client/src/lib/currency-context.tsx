import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useUser } from "./user-context";
import { WORLD_COUNTRIES } from "./world-countries";
import { getCurrencyForCountry, isCurrencySupported, getEffectiveCurrency, SUPPORTED_CURRENCIES } from "./country-currency-map";

export type CurrencyCode = "USD" | "GBP" | "INR" | "CAD" | "AUD" | "EUR";

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: CurrencyCode | string; // Can be any currency code
  currencySymbol: string;
  currencyName: string;
  isSupported: boolean; // Whether live rates are available
  effectiveCurrency: string; // Actual currency used (fallback if not supported)
}

// Build full country list from world countries + currency mapping
export const COUNTRIES: Country[] = WORLD_COUNTRIES.map(wc => {
  const currencyInfo = getCurrencyForCountry(wc.code);
  const isSupported = isCurrencySupported(currencyInfo.currencyCode);
  const effectiveCurrency = getEffectiveCurrency(currencyInfo.currencyCode);
  
  // Get flag emoji from country code
  const flag = wc.code
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
  
  return {
    code: wc.code,
    name: wc.name,
    flag,
    currency: currencyInfo.currencyCode,
    currencySymbol: currencyInfo.currencySymbol,
    currencyName: currencyInfo.currencyName,
    isSupported,
    effectiveCurrency,
  };
});

// Add "Global" as first option
COUNTRIES.unshift({
  code: "ALL",
  name: "Global",
  flag: "🌐",
  currency: "USD",
  currencySymbol: "$",
  currencyName: "US Dollar",
  isSupported: true,
  effectiveCurrency: "USD",
});

const STORAGE_KEY_COUNTRY = "selectedCountry";
const STORAGE_KEY_VISITED = "countrySelectionSeen";
const STORAGE_KEY_RATES = "exchangeRates";
const STORAGE_KEY_RATES_TIMESTAMP = "exchangeRatesTimestamp";
const RATES_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface CurrencyContextType {
  selectedCountry: Country;
  setCountry: (country: Country) => void;
  formatPrice: (priceInUSD: number) => string;
  formatPriceForCountry: (priceInUSD: number, countryCode?: string) => string;
  formatPriceExactForCountry: (amount: number, countryCode?: string) => string;
  formatPriceFromTo: (amount: number, fromCountryCode?: string, toCountryCode?: string) => string;
  convertPriceFromTo: (amount: number, fromCountryCode?: string, toCountryCode?: string) => number;
  convertPrice: (amount: number, fromCurrency: string, toCurrency: string) => number;
  showCountrySelector: boolean;
  setShowCountrySelector: (show: boolean) => void;
  hasSeenCountrySelector: boolean;
  exchangeRates: Record<string, number>;
  isRatesLoaded: boolean;
  showUnsupportedCurrencyNotice: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useUser();
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [hasSeenCountrySelector, setHasSeenCountrySelector] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showUnsupportedCurrencyNotice, setShowUnsupportedCurrencyNotice] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1,
    GBP: 0.79,
    INR: 83.5,
    CAD: 1.35,
    AUD: 1.52,
    EUR: 0.92,
  });
  const [isRatesLoaded, setIsRatesLoaded] = useState(false);

  // Fetch live exchange rates from backend
  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Check if we have cached rates
        if (typeof window !== "undefined") {
          const cachedRates = localStorage.getItem(STORAGE_KEY_RATES);
          const cachedTimestamp = localStorage.getItem(STORAGE_KEY_RATES_TIMESTAMP);
          const now = Date.now();

          // Return cached rates if still fresh
          if (cachedRates && cachedTimestamp) {
            const timestamp = parseInt(cachedTimestamp, 10);
            if (now - timestamp < RATES_CACHE_DURATION) {
              const rates = JSON.parse(cachedRates) as Record<string, number>;
              setExchangeRates(rates);
              setIsRatesLoaded(true);
              return;
            }
          }
        }

        // Fetch fresh rates from backend
        const response = await fetch("/api/currency-rates");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = (await response.json()) as { rates: Record<string, number> };
        const rates = data.rates;

        // Update state
        setExchangeRates(rates);

        // Cache rates in localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rates));
          localStorage.setItem(STORAGE_KEY_RATES_TIMESTAMP, String(Date.now()));
        }

        setIsRatesLoaded(true);
      } catch (error) {
        console.warn("Failed to fetch live exchange rates:", error);
        // Use default rates that are already set
        setIsRatesLoaded(true);
      }
    };

    fetchRates();
  }, []);

  // Initialize country selection with priority: User Profile > localStorage > URL params > Default
  useEffect(() => {
    if (typeof window === "undefined") return;

    let countryToSet: Country | null = null;
    let shouldShowPopup = false;

    // PRIORITY 1: Logged-in user with saved preference
    if (isAuthenticated && user?.preferredCountry) {
      const country = COUNTRIES.find(c => c.code === user.preferredCountry);
      if (country) {
        countryToSet = country;
        // Also sync to localStorage for consistency
        localStorage.setItem(STORAGE_KEY_COUNTRY, country.code);
        localStorage.setItem(STORAGE_KEY_VISITED, "true");
      }
    }
    
    // PRIORITY 2: localStorage (guest user or logged-in user without preference)
    if (!countryToSet) {
      const storedCountry = localStorage.getItem(STORAGE_KEY_COUNTRY);
      if (storedCountry) {
        const country = COUNTRIES.find(c => c.code === storedCountry);
        if (country) {
          countryToSet = country;
          
          // If user just logged in and has localStorage but no profile preference, sync to profile
          if (isAuthenticated && !user?.preferredCountry) {
            syncCountryToUserProfile(country);
          }
        }
      }
    }

    // PRIORITY 3: URL parameter
    if (!countryToSet) {
      const params = new URLSearchParams(window.location.search);
      const countryCode = params.get("country");
      if (countryCode) {
        const country = COUNTRIES.find(c => c.code === countryCode);
        if (country) countryToSet = country;
      }
    }

    // Determine if popup should show
    const seen = localStorage.getItem(STORAGE_KEY_VISITED) === "true";
    setHasSeenCountrySelector(seen);
    
    if (!countryToSet && !seen) {
      // No preference anywhere and haven't seen popup
      shouldShowPopup = true;
    }

    // Apply selected country
    if (countryToSet) {
      setSelectedCountry(countryToSet);
    }

    setShowCountrySelector(shouldShowPopup);
    setIsInitialized(true);
  }, [user, isAuthenticated]);

  // Helper to sync country selection to user profile
  const syncCountryToUserProfile = async (country: Country) => {
    if (!isAuthenticated) return;
    
    try {
      await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          preferredCountry: country.code,
          preferredCurrency: country.effectiveCurrency, // Use effectiveCurrency (USD fallback)
        }),
      });
    } catch (error) {
      console.warn("Failed to sync country to user profile:", error);
      // Non-blocking - localStorage still works
    }
  };

  const setCountry = (country: Country) => {
    setShowUnsupportedCurrencyNotice(!country.isSupported);
    setSelectedCountry(country);
    
    // Always save to localStorage for instant persistence
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_COUNTRY, country.code);
      localStorage.setItem(STORAGE_KEY_VISITED, "true");
      setHasSeenCountrySelector(true);
    }

    // If logged in, also save to user profile (non-blocking)
    if (isAuthenticated) {
      syncCountryToUserProfile(country);
    }
  };

  // Helper to get exchange rate for a currency
  const getExchangeRate = (currencyCode: CurrencyCode): number => {
    return exchangeRates[currencyCode] || 1;
  };

  // Convert between currencies using live rates
  const convertPrice = (amount: number, fromCurrency: string, toCurrency: string): number => {
    try {
      if (fromCurrency === toCurrency) return amount;
      if (!isRatesLoaded) return amount; // Fallback if rates not loaded yet
      
      // Convert from source currency to USD, then to target currency
      const fromRate = exchangeRates[fromCurrency] || 1;
      const toRate = exchangeRates[toCurrency] || 1;
      
      if (fromRate === 0 || toRate === 0) return amount;
      
      // Formula: (amount / fromRate) * toRate
      // This converts amount from source currency to USD, then to target
      const amountInUSD = amount / fromRate;
      const result = amountInUSD * toRate;
      
      return result;
    } catch (error) {
      console.warn(`Conversion error from ${fromCurrency} to ${toCurrency}:`, error);
      return amount;
    }
  };

  const formatPrice = (priceInUSD: number) => {
    // Use effectiveCurrency for conversion (USD fallback for unsupported currencies)
    const convertedPrice = convertPrice(priceInUSD, "USD", selectedCountry.effectiveCurrency);
    return new Intl.NumberFormat(selectedCountry.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: selectedCountry.effectiveCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertedPrice);
  };

  const formatPriceForCountry = (priceInUSD: number, countryCode?: string) => {
    const key = (countryCode || selectedCountry.code) || '';
    const byCode = COUNTRIES.find(c => c.code === key);
    const byName = COUNTRIES.find(c => c.name.toLowerCase() === key.toLowerCase());
    const country = byCode || byName || selectedCountry;
    // Use effectiveCurrency for conversion (USD fallback for unsupported currencies)
    const convertedPrice = convertPrice(priceInUSD, "USD", country.effectiveCurrency);
    return new Intl.NumberFormat(country.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: country.effectiveCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertedPrice);
  };

  const formatPriceExactForCountry = (amount: number, countryCode?: string) => {
    const key = (countryCode || selectedCountry.code) || '';
    const byCode = COUNTRIES.find(c => c.code === key);
    const byName = COUNTRIES.find(c => c.name.toLowerCase() === key.toLowerCase());
    const country = byCode || byName || selectedCountry;
    // Use effectiveCurrency for display (USD fallback for unsupported currencies)
    return new Intl.NumberFormat(country.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: country.effectiveCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPriceFromTo = (amount: number, fromCountryCode?: string, toCountryCode?: string) => {
    const fromKey = (fromCountryCode || selectedCountry.code) || '';
    const toKey = (toCountryCode || selectedCountry.code) || '';
    const find = (k: string) => COUNTRIES.find(c => c.code === k) || COUNTRIES.find(c => c.name.toLowerCase() === k.toLowerCase()) || selectedCountry;
    const from = find(fromKey);
    const to = find(toKey);
    // Use effectiveCurrency for conversion (USD fallback for unsupported currencies)
    const converted = convertPrice(amount, from.effectiveCurrency, to.effectiveCurrency);
    return new Intl.NumberFormat(to.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: to.effectiveCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(converted);
  };

  const convertPriceFromTo = (amount: number, fromCountryCode?: string, toCountryCode?: string) => {
    const fromKey = (fromCountryCode || selectedCountry.code) || '';
    const toKey = (toCountryCode || selectedCountry.code) || '';
    const find = (k: string) => COUNTRIES.find(c => c.code === k) || COUNTRIES.find(c => c.name.toLowerCase() === k.toLowerCase()) || selectedCountry;
    const from = find(fromKey);
    const to = find(toKey);
    // Use effectiveCurrency for conversion (USD fallback for unsupported currencies)
    return convertPrice(amount, from.effectiveCurrency, to.effectiveCurrency);
  };

  return (
    <CurrencyContext.Provider value={{ selectedCountry, setCountry, formatPrice, formatPriceForCountry, formatPriceExactForCountry, formatPriceFromTo, convertPriceFromTo, convertPrice, showCountrySelector, setShowCountrySelector, hasSeenCountrySelector, exchangeRates, isRatesLoaded, showUnsupportedCurrencyNotice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
