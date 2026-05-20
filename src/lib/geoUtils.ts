
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

export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=pt`,
      { headers: { 'User-Agent': 'AG-PILOTO/1.0' } }
    );
    const data = await response.json();
    const nome = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return nome;
  } catch (error) {
    console.error('Error reverse geocoding coordinates:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
