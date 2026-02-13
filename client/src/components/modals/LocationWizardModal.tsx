import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface LocationWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Country {
  id: string;
  code: string;
  name: string;
  slug: string;
}

interface State {
  id: string;
  countryId: string;
  name: string;
  slug: string;
}

interface City {
  id: string;
  stateId: string;
  name: string;
  slug: string;
}

export function LocationWizardModal({ open, onOpenChange }: LocationWizardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [selectedStateId, setSelectedStateId] = useState<string>("");
  const [selectedCityId, setSelectedCityId] = useState<string>("");

  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load countries on mount
  useEffect(() => {
    if (open) {
      loadCountries();
    }
  }, [open]);

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const response = await fetch("/api/locations/countries");
      const data = await response.json();
      setCountries(data.countries || []);
    } catch (error) {
      console.error("Failed to load countries:", error);
      toast({
        title: "Error",
        description: "Failed to load countries. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadStates = async (countryId: string) => {
    setLoadingStates(true);
    setStates([]);
    setCities([]);
    setSelectedStateId("");
    setSelectedCityId("");
    
    try {
      const response = await fetch(`/api/locations/states/${countryId}`);
      const data = await response.json();
      setStates(data.states || []);
    } catch (error) {
      console.error("Failed to load states:", error);
      toast({
        title: "Error",
        description: "Failed to load states. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingStates(false);
    }
  };

  const loadCities = async (stateId: string) => {
    setLoadingCities(true);
    setCities([]);
    setSelectedCityId("");
    
    try {
      const response = await fetch(`/api/locations/cities/${stateId}`);
      const data = await response.json();
      setCities(data.cities || []);
    } catch (error) {
      console.error("Failed to load cities:", error);
      toast({
        title: "Error",
        description: "Failed to load cities. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingCities(false);
    }
  };

  const handleCountryChange = (countryId: string) => {
    setSelectedCountryId(countryId);
    loadStates(countryId);
  };

  const handleStateChange = (stateId: string) => {
    setSelectedStateId(stateId);
    loadCities(stateId);
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId);
  };

  const handleSave = async () => {
    if (!selectedCountryId || !selectedStateId || !selectedCityId) {
      toast({
        title: "Incomplete Selection",
        description: "Please select a country, state, and city.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/detectives/me/location", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryId: selectedCountryId,
          stateId: selectedStateId,
          cityId: selectedCityId
        }),
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update location");
      }

      toast({
        title: "Location Updated",
        description: "Your profile location has been successfully updated. Your profile is now visible in search results!",
      });

      // Invalidate queries to refresh detective data
      await queryClient.invalidateQueries({ queryKey: ["/api/detectives/me"] });
      await queryClient.invalidateQueries({ queryKey: ["detective-dashboard"] });

      onOpenChange(false);
      
      // Reset form
      setSelectedCountryId("");
      setSelectedStateId("");
      setSelectedCityId("");
      setStates([]);
      setCities([]);
    } catch (error) {
      console.error("Failed to update location:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update location. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = selectedCountryId && selectedStateId && selectedCityId && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Your Location</DialogTitle>
          <DialogDescription>
            Select your business location to make your profile visible in search results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select
              value={selectedCountryId}
              onValueChange={handleCountryChange}
              disabled={loadingCountries}
            >
              <SelectTrigger id="country">
                <SelectValue placeholder={loadingCountries ? "Loading countries..." : "Select a country"} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* State Selection */}
          <div className="space-y-2">
            <Label htmlFor="state">State / Province</Label>
            <Select
              value={selectedStateId}
              onValueChange={handleStateChange}
              disabled={!selectedCountryId || loadingStates}
            >
              <SelectTrigger id="state">
                <SelectValue 
                  placeholder={
                    !selectedCountryId 
                      ? "Select a country first" 
                      : loadingStates 
                        ? "Loading states..." 
                        : "Select a state"
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* City Selection */}
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Select
              value={selectedCityId}
              onValueChange={handleCityChange}
              disabled={!selectedStateId || loadingCities}
            >
              <SelectTrigger id="city">
                <SelectValue 
                  placeholder={
                    !selectedStateId 
                      ? "Select a state first" 
                      : loadingCities 
                        ? "Loading cities..." 
                        : "Select a city"
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Location"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
