import { LocationContent } from "../components/LocationContent";

export const renderCountryPage = (country) => {
  return (
    <>
      <div>
        <h1>{country}</h1>
        <p>Detected</p>
      </div>
      <LocationContent country={country} />
    </>
  );
};