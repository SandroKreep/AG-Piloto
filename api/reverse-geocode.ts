export default async function handler(req: any, res: any) {
  const { lat, lon } = req.query
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' })
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          'User-Agent': 'AG-PILOTO/1.0 (ag-piloto.vercel.app)',
          'Accept': 'application/json',
          'Accept-Language': 'pt'
        }
      }
    )
    const data = await response.json()
    res.setHeader('Cache-Control', 's-maxage=60')
    return res.status(200).json(data)
  } catch {
    return res.status(500).json({ error: 'Reverse geocoding failed' })
  }
}
