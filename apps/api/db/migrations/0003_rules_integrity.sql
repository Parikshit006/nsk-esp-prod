CREATE UNIQUE INDEX rule_templates_name_ci ON rule_templates(lower(name));
CREATE OR REPLACE FUNCTION reject_template_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'template revisions are immutable'; END;
$$;
CREATE TRIGGER template_revision_immutable BEFORE UPDATE OR DELETE ON rule_template_revisions FOR EACH ROW EXECUTE FUNCTION reject_template_revision_change();
CREATE OR REPLACE FUNCTION guard_ruleset_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'rulesets cannot be deleted'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tournament_id IS DISTINCT FROM OLD.tournament_id OR NEW.version_no IS DISTINCT FROM OLD.version_no OR NEW.config IS DISTINCT FROM OLD.config OR NEW.source_template_revision_id IS DISTINCT FROM OLD.source_template_revision_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'ruleset contents are immutable';
  END IF;
  IF NOT ((OLD.status='Draft' AND NEW.status='Confirmed') OR (OLD.status='Confirmed' AND NEW.status='Frozen')) THEN
    RAISE EXCEPTION 'invalid ruleset transition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ruleset_immutable BEFORE UPDATE OR DELETE ON tournament_rulesets FOR EACH ROW EXECUTE FUNCTION guard_ruleset_change();
UPDATE platform_metadata SET schema_version=3 WHERE singleton=true;
