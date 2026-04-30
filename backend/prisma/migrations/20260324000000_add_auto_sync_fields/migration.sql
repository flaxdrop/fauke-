-- Add auto-sync scheduling fields to Integration
ALTER TABLE "Integration" ADD COLUMN "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Integration" ADD COLUMN "autoSyncTime" TEXT;
ALTER TABLE "Integration" ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- Add index for efficient querying of enabled auto-sync integrations
CREATE INDEX "Integration_autoSyncEnabled_idx" ON "Integration"("autoSyncEnabled");
