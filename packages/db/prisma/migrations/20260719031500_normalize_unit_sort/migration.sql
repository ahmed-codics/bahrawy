WITH ranked_units AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "chapterId"
      ORDER BY "sort" ASC, "createdAt" ASC, "id" ASC
    ) - 1 AS normalized_sort
  FROM "Unit"
)
UPDATE "Unit" AS unit
SET "sort" = ranked_units.normalized_sort
FROM ranked_units
WHERE unit."id" = ranked_units."id";
