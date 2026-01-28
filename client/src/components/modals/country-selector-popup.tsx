import { useState, useEffect } from "react";
import { useCurrency, COUNTRIES } from "@/lib/currency-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Info } from "lucide-react";

export default function CountrySelectorPopup() {
  const { showCountrySelector, setShowCountrySelector, selectedCountry, setCountry, showUnsupportedCurrencyNotice } = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCountries, setFilteredCountries] = useState(COUNTRIES);

  // Filter countries based on search
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query) ||
        country.currency.toLowerCase().includes(query) ||
        country.currencyName.toLowerCase().includes(query)
    );
    setFilteredCountries(filtered);
  }, [searchQuery]);

  const handleSelectCountry = (country: typeof COUNTRIES[0]) => {
    setCountry(country);
    setShowCountrySelector(false);
    setSearchQuery("");
  };

  const handleGotIt = () => {
    setShowCountrySelector(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={showCountrySelector} onOpenChange={setShowCountrySelector}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Select the country you want to search in
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 pt-2">
            This helps us show prices in the right currency for you
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search countries or currencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>

          {/* Unsupported Currency Notice */}
          {showUnsupportedCurrencyNotice && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <span className="font-medium">{selectedCountry.currencyName}</span> is not yet supported. 
                Prices are shown in <span className="font-medium">USD</span> for now.
              </div>
            </div>
          )}

          {/* Countries List */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white">
            {filteredCountries.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => handleSelectCountry(country)}
                    className={`w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center gap-3 ${
                      selectedCountry.code === country.code
                        ? "bg-green-50 border-l-4 border-green-600"
                        : ""
                    }`}
                  >
                    <span className="text-2xl">{country.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">
                        {country.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {country.currencyName} ({country.currencySymbol})
                        {!country.isSupported && (
                          <span className="ml-2 text-xs text-blue-600 font-medium">
                            Prices in USD
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedCountry.code === country.code && (
                      <div className="text-green-600 flex-shrink-0">✓</div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <p>No countries found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleGotIt}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
