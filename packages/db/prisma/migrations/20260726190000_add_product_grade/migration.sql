ALTER TABLE "Product" ADD COLUMN "gradeId" TEXT;

UPDATE "Product" AS product
SET "gradeId" = inferred."gradeId"
FROM (
  SELECT
    product_course."productId",
    MIN(course."gradeId") AS "gradeId"
  FROM "ProductCourse" AS product_course
  INNER JOIN "Course" AS course ON course."id" = product_course."courseId"
  WHERE course."gradeId" IS NOT NULL
  GROUP BY product_course."productId"
  HAVING COUNT(DISTINCT course."gradeId") = 1
) AS inferred
WHERE product."id" = inferred."productId";

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_gradeId_fkey"
  FOREIGN KEY ("gradeId") REFERENCES "Grade"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Product_gradeId_idx" ON "Product"("gradeId");
