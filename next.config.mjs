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
  '172.20.10.5:3000',
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(',') ?? []),
]
  .map(toAllowedDevHostname)
  .filter(Boolean)

const nextConfig = {
  allowedDevOrigins: localNetworkOrigins,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
