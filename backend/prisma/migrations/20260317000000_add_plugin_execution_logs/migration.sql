-- CreateTable
CREATE TABLE "PluginExecutionLog" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "action" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PluginExecutionLog_pluginId_idx" ON "PluginExecutionLog"("pluginId");

-- CreateIndex
CREATE INDEX "PluginExecutionLog_createdAt_idx" ON "PluginExecutionLog"("createdAt");

-- CreateIndex
CREATE INDEX "PluginExecutionLog_status_idx" ON "PluginExecutionLog"("status");
