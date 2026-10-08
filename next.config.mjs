/** @type {import('next').NextConfig} */
function toAllowedDevHostname(origin) {
  const value = origin.trim()
  if (!value) return ''

  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname
  } catch {
    return value.split(':')[0]
  }
}

const localNetworkOrigins = [
  '192.168.205.25',
  '192.168.205.25:3000',
  '172.20.10.5:3000',
  'localhost:3000',
  '127.0.0.1:3000',
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',') ?? []),
]
  .map(toAllowedDevHostname)
  .filter(Boolean)

const nextConfig = {
  allowedDevOrigins: localNetworkOrigins,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
