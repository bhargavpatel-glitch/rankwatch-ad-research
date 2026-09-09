export const BRAND_LOGO_MAP: Record<string, string> = {
  'Semrush': '/logos/semrush.png',
  'Profound': '/logos/profound.png',
  'Peec AI': '/logos/peec-ai.png',
  'Scrunch': '/logos/scrunch.png',
  'AccuRanker': '/logos/accuranker.png',
  'Otterly AI': '/logos/otterly-ai.png',
  'AthenaHQ': '/logos/athenahq.png',
  'Mangools': '/logos/mangools.png',
  'Rankscale': '/logos/rankscale.png',
  'NuvoTech': '/logos/nuvotech.png',
  'CodeCat': '/logos/codecat.png',
  'eTarg Media': '/logos/etarg-media.png'
};

export const BRAND_DOMAINS: Record<string, string> = {
  'Semrush': 'semrush.com',
  'Profound': 'tryprofound.com',
  'Peec AI': 'peec.ai',
  'Scrunch': 'scrunch.com',
  'AccuRanker': 'accuranker.com',
  'Otterly AI': 'otterly.ai',
  'AthenaHQ': 'athenahq.ai',
  'Mangools': 'mangools.com',
  'Rankscale': 'rankscale.ai',
  'NuvoTech': 'athenahq.ai',
  'CodeCat': 'mangools.com',
  'eTarg Media': 'accuranker.com'
};

export function getBrandLogo(brandName: string): string {
  if (!brandName) return '/logos/semrush.png';
  if (BRAND_LOGO_MAP[brandName]) {
    return BRAND_LOGO_MAP[brandName];
  }

  const normalized = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [name, path] of Object.entries(BRAND_LOGO_MAP)) {
    if (name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized) {
      return path;
    }
  }

  const domain = BRAND_DOMAINS[brandName] || `${normalized}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
