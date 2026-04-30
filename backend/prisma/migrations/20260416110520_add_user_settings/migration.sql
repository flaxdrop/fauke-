-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{"language": "en", "timezone": "UTC", "emailNotifications": true}';
