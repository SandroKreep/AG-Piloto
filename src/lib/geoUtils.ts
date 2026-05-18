
export function formatCurrency(price: number): string {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(price);
}

export function isValidLuandaCoordinate(latitude: number, longitude: number): boolean {
  const minLat = -9.30;
  const maxLat = -8.40;
  const minLon = 13.00;
  const maxLon = 13.60;

  return latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon;
}

export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=pt`,
      { headers: { 'User-Agent': 'AG-PILOTO/1.0' } }
    );
    const data = await response.json();
    if (data && data.display_name) {
      return data.display_name;
    }
    return null;
  } catch (error) {
    console.error('Error reverse geocoding coordinates:', error);
    return null;
  }
}
