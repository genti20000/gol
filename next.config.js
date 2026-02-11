/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'files.londonkaraoke.club',
                port: '',
                pathname: '/**',
            },
        ],
    },
};

module.exports = nextConfig;
