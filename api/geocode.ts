export default async function handler(req: any, res: any) {
  const { q } = req.query
  
  if (!q) {
    return res.status(400).json({ error: 'Query required' })
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=ao`,
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
  } catch (error) {
    return res.status(500).json({ error: 'Geocoding failed' })
  }
}
