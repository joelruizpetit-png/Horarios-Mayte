import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Planificador Familiar',
    short_name: 'Planificador',
    description: 'OS Familiar de Ana, Joel y Alma',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d4ed8',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
