ALTER TABLE refund_reviews ADD COLUMN source text NOT NULL DEFAULT 'Cancellation' CHECK(source IN ('Cancellation','Withdrawal'));
ALTER TABLE refund_reviews ADD COLUMN request_reason text;
UPDATE platform_metadata SET schema_version=26 WHERE singleton=true;
