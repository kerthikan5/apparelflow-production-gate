ALTER TABLE "Recipe" ADD CHECK ("stdFabricYards">0), ADD CHECK ("wastageCap">=0);
ALTER TABLE "RecipeComponent" ADD CHECK ("piecesPerGarment">0);
ALTER TABLE "CuttingOrder" ADD CHECK ("targetQty">0 AND "targetQty"<=100000), ADD CHECK ("actualFabricYds">0), ADD CHECK (length(trim("fabricRollId"))>0), ADD CHECK ("assemblyStartedAt" IS NULL OR status='VERIFIED');
ALTER TABLE "VerificationItem" ADD CHECK ("expectedQty">0), ADD CHECK ("actualQty">=0), ADD CHECK (
 ("actualQty" IS NULL AND status IS NULL) OR ("actualQty" IS NOT NULL AND status IS NOT NULL AND
 (("actualQty"="expectedQty" AND status='GREEN') OR ("actualQty">"expectedQty" AND status='YELLOW') OR ("actualQty"<"expectedQty" AND status='RED'))));
ALTER TABLE "VerificationLog" ADD CHECK (decision<>'REJECTED' OR ("rejectionNote" IS NOT NULL AND length(trim("rejectionNote"))>0));
CREATE UNIQUE INDEX "one_approval_per_order" ON "VerificationLog"("orderId") WHERE decision='APPROVED';

CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Verification history is immutable'; END $$;
CREATE TRIGGER immutable_verification_log BEFORE UPDATE OR DELETE ON "VerificationLog" FOR EACH ROW EXECUTE FUNCTION immutable_audit();

CREATE FUNCTION protect_verified_items() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch_id TEXT;
BEGIN
 batch_id := CASE WHEN TG_OP='DELETE' THEN OLD."orderId" ELSE NEW."orderId" END;
 IF EXISTS (SELECT 1 FROM "CuttingOrder" WHERE id=batch_id AND status='VERIFIED') THEN
  RAISE EXCEPTION 'Approved component counts are immutable';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF EXISTS (SELECT 1 FROM "CuttingOrder" WHERE id=OLD."orderId" AND status='VERIFIED') THEN RAISE EXCEPTION 'Approved component counts are immutable'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_verified_items BEFORE INSERT OR UPDATE OR DELETE ON "VerificationItem" FOR EACH ROW EXECUTE FUNCTION protect_verified_items();

CREATE FUNCTION protect_order_gate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='VERIFIED' AND
 (to_jsonb(NEW)-'assemblyStartedAt'-'updatedAt'-'version') IS DISTINCT FROM (to_jsonb(OLD)-'assemblyStartedAt'-'updatedAt'-'version') THEN
  RAISE EXCEPTION 'Approved batch data is immutable';
 END IF;
 IF OLD."assemblyStartedAt" IS NOT NULL AND NEW."assemblyStartedAt" IS DISTINCT FROM OLD."assemblyStartedAt" THEN RAISE EXCEPTION 'Assembly start is immutable'; END IF;
 IF NEW.status='VERIFIED' AND OLD.status<>'VERIFIED' THEN
  IF OLD.status<>'PENDING_VERIFICATION' OR NOT EXISTS (SELECT 1 FROM "VerificationLog" WHERE "orderId"=NEW.id AND decision='APPROVED')
  OR EXISTS (
   SELECT 1 FROM "RecipeComponent" c LEFT JOIN "VerificationItem" i ON i."componentId"=c.id AND i."orderId"=NEW.id
   WHERE c."recipeId"=NEW."recipeId" AND (i.id IS NULL OR i."actualQty" IS NULL OR i."actualQty"<c."piecesPerGarment"*NEW."targetQty")
  ) THEN RAISE EXCEPTION 'Verification gate failed'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_order_gate BEFORE UPDATE ON "CuttingOrder" FOR EACH ROW EXECUTE FUNCTION protect_order_gate();
