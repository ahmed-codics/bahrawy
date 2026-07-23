UPDATE "PaymentOrder" AS payment
SET "organizationId" = product."organizationId"
FROM "Product" AS product
WHERE payment."productId" = product."id"
  AND payment."organizationId" <> product."organizationId";

UPDATE "StoredObject" AS proof
SET "organizationId" = payment."organizationId"
FROM "PaymentOrder" AS payment
WHERE payment."proofObjectId" = proof."id"
  AND proof."organizationId" <> payment."organizationId";
