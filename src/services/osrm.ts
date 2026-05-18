export interface Coordinates {
  lat: number
  lng: number
}

export type OsrmRoute = {
  distanceMeters: number
  durationSeconds: number
  geometry: [number, number][]
}

export async function fetchOsrmRoute(pickup: Coordinates, dropoff: Coordinates): Promise<OsrmRoute> {
  const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving/';
  const coordinates = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const url = `${OSRM_BASE_URL}${coordinates}?overview=full&geometries=geojson`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Falha ao calcular rota OSRM: ' + response.statusText);
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: {
        coordinates: [number, number][];
      };
    }>;
  };

  const firstRoute = payload.routes?.[0];
  if (!firstRoute) {
    throw new Error('Nenhuma rota encontrada pelo OSRM.');
  }

  return {
    distanceMeters: firstRoute.distance,
    durationSeconds: firstRoute.duration,
    geometry: firstRoute.geometry.coordinates,
  };
}