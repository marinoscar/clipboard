export default () => {
  // Set DATABASE_URL for Prisma (SQLite)
  const databaseUrl = process.env.DATABASE_URL || 'file:./data/clipboard.db';
  process.env.DATABASE_URL = databaseUrl;

  return {
    // Application
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL || 'http://localhost:8320',

    // Database
    database: {
      url: databaseUrl,
    },

    // JWT
    jwt: {
      secret: process.env.JWT_SECRET,
      accessTtlMinutes: parseInt(process.env.JWT_ACCESS_TTL_MINUTES || '15', 10),
      refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS || '14', 10),
    },

    // OAuth - Google
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },

    // Admin bootstrap
    initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL,

    // Storage Configuration (S3)
    storage: {
      s3: {
        bucket: process.env.S3_BUCKET || '',
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10), // 10GB default
      signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600', 10), // 1 hour
      partSize: parseInt(process.env.STORAGE_PART_SIZE || '10485760', 10), // 10MB
    },

    logLevel: process.env.LOG_LEVEL || 'info',
  };
};
