import React from "react";

interface CityFAQProps {
  city: string;
  state: string;
}

export const CityFAQ: React.FC<CityFAQProps> = ({ city, state }) => {
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  const cityName = cap(city);
  const stateName = cap(state);

  return (
    <section className="city-faq">
      <h2>Frequently Asked Questions</h2>

      <h3>How much does a private detective cost in {cityName}?</h3>
      <p>
        The cost of hiring a private detective in {cityName} can vary depending on the type of investigation, the detective's experience, and the complexity of the case. Typical fees may range from hourly rates to fixed project costs. It's best to request a quote from several agencies in {cityName} to compare pricing and services.
      </p>

      <h3>How to hire a private investigator in {cityName}?</h3>
      <p>
        To hire a private investigator in {cityName}, start by researching licensed and reputable agencies or independent detectives. Review their credentials, client testimonials, and areas of expertise. Contact your chosen detective to discuss your case, request a consultation, and confirm their approach and confidentiality policies.
      </p>

      <h3>Are private investigators legal in {cityName}, {stateName}?</h3>
      <p>
        Yes, private investigators are legal in {cityName}, {stateName}, provided they operate within the boundaries of the law. Licensed detectives must adhere to local regulations and ethical standards. Always verify the credentials and licensing status of any investigator you hire in {cityName}.
      </p>
    </section>
  );
};
