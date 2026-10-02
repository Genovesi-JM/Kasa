import { properties, providers, spaceVenues, workOpportunities } from "./data";

export type SearchScope = "all" | "homes" | "work" | "services" | "spaces";

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesSearch(query: string, ...fields: string[]) {
  const text = normalizeSearch(fields.join(" "));
  return normalizeSearch(query)
    .split(" ")
    .every((word) => text.includes(word));
}

export function marketplaceMatches(query: string) {
  const homes = properties.filter((property) =>
    matchesSearch(
      query,
      property.title,
      property.address,
      property.city,
      property.neighbourhood,
      property.propertyType,
      ...property.amenities,
    ),
  );
  return {
    rent: homes.filter((property) => property.listingType === "Rent"),
    buy: homes.filter((property) => property.listingType === "Buy"),
    services: providers.filter((provider) =>
      matchesSearch(query, provider.name, provider.type, provider.mode),
    ),
    work: workOpportunities.filter((job) =>
      matchesSearch(
        query,
        job.title,
        job.business,
        job.location,
        ...job.skills,
      ),
    ),
    spaces: spaceVenues.filter((venue) =>
      matchesSearch(
        query,
        venue.name,
        venue.neighbourhood,
        venue.category,
        venue.description,
        ...venue.amenities,
        ...venue.spaces.map((space) => space.activity),
      ),
    ),
  };
}
