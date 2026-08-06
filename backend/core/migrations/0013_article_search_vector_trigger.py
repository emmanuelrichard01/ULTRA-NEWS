from django.db import migrations

# `search_vector` had a GIN index but nothing anywhere populated it, so every
# full-text query matched zero rows. Maintaining it in a trigger rather than in
# application code means it stays correct no matter which path writes an Article
# (ingest task, admin, shell, data migration, bulk import).

CREATE_FUNCTION = """
CREATE OR REPLACE FUNCTION core_article_search_vector_update()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;
"""

DROP_FUNCTION = "DROP FUNCTION IF EXISTS core_article_search_vector_update() CASCADE;"

CREATE_TRIGGER = """
DROP TRIGGER IF EXISTS core_article_search_vector_trigger ON core_article;
CREATE TRIGGER core_article_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, excerpt ON core_article
FOR EACH ROW EXECUTE FUNCTION core_article_search_vector_update();
"""

DROP_TRIGGER = "DROP TRIGGER IF EXISTS core_article_search_vector_trigger ON core_article;"

# Backfill every row that predates the trigger.
BACKFILL = """
UPDATE core_article SET search_vector =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B');
"""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_source_publisher_domain'),
    ]

    operations = [
        migrations.RunSQL(CREATE_FUNCTION, DROP_FUNCTION),
        migrations.RunSQL(CREATE_TRIGGER, DROP_TRIGGER),
        migrations.RunSQL(BACKFILL, migrations.RunSQL.noop),
    ]
