-- Fixes drift: schema.prisma has InAppNotification.metadata but no prior
-- migration added the column, breaking the post-login student dashboard load.
ALTER TABLE "InAppNotification" ADD COLUMN "metadata" JSONB;
