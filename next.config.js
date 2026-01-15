/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 启用 standalone 输出，用于 Docker 部署优化
  output: 'standalone',
}

module.exports = nextConfig
