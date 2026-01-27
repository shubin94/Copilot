import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type CurrencyCode = "USD" | "GBP" | "INR" | "CAD" | "AUD" | "EUR";

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: CurrencyCode;
  currencySymbol: string;
  exchangeRate: number; // Relative to USD (USD = 1)
}

// Enhanced country data with currency info
export const COUNTRIES: Country[] = [
  { code: "ALL", name: "Global", flag: "🌐", currency: "USD", currencySymbol: "$", exchangeRate: 1 },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", currencySymbol: "$", exchangeRate: 1 },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", currencySymbol: "£", exchangeRate: 0.79 },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", currencySymbol: "₹", exchangeRate: 83.5 },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", currencySymbol: "C$", exchangeRate: 1.35 },
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", currencySymbol: "A$", exchangeRate: 1.52 },
  { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", currencySymbol: "€", exchangeRate: 0.92 },
  { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", currencySymbol: "€", exchangeRate: 0.92 },
];

interface CurrencyContextType {
  selectedCountry: Country;
  setCountry: (country: Country) => void;
  formatPrice: (priceInUSD: number) => string;
  formatPriceForCountry: (priceInUSD: number, countryCode?: string) => string;
  formatPriceExactForCountry: (amount: number, countryCode?: string) => string;
  formatPriceFromTo: (amount: number, fromCountryCode?: string, toCountryCode?: string) => string;
  convertPriceFromTo: (amount: number, fromCountryCode?: string, toCountryCode?: string) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);

  // Initialize from URL or localStorage if needed (logic moved from Navbar)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const countryCode = params.get("country");
    if (countryCode) {
      const country = COUNTRIES.find(c => c.code === countryCode);
      if (country) setSelectedCountry(country);
    }
  }, []);

  const setCountry = (country: Country) => {
    setSelectedCountry(country);
    // URL update logic can happen here or in the component triggering the change
    // For now, we'll keep URL logic in Navbar to avoid side effects in Context
  };

  const formatPrice = (priceInUSD: number) => {
    const convertedPrice = priceInUSD * selectedCountry.exchangeRate;
    return new Intl.NumberFormat(selectedCountry.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: selectedCountry.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertedPrice);
  };

  const formatPriceForCountry = (priceInUSD: number, countryCode?: string) => {
    const key = (countryCode || selectedCountry.code) || '';
    const byCode = COUNTRIES.find(c => c.code === key);
    const byName = COUNTRIES.find(c => c.name.toLowerCase() === key.toLowerCase());
    const country = byCode || byName || selectedCountry;
    const convertedPrice = priceInUSD * country.exchangeRate;
    return new Intl.NumberFormat(country.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: country.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertedPrice);
  };

  const formatPriceExactForCountry = (amount: number, countryCode?: string) => {
    const key = (countryCode || selectedCountry.code) || '';
    const byCode = COUNTRIES.find(c => c.code === key);
    const byName = COUNTRIES.find(c => c.name.toLowerCase() === key.toLowerCase());
    const country = byCode || byName || selectedCountry;
    return new Intl.NumberFormat(country.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: country.currency,
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
    const factor = to.exchangeRate / from.exchangeRate;
    const converted = amount * factor;
    return new Intl.NumberFormat(to.code === 'IN' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: to.currency,
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
    const factor = to.exchangeRate / from.exchangeRate;
    return amount * factor;
  };

  return (
    <CurrencyContext.Provider value={{ selectedCountry, setCountry, formatPrice, formatPriceForCountry, formatPriceExactForCountry, formatPriceFromTo, convertPriceFromTo }}>
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
