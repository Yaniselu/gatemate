-- Gatemate Pro (App Store / Google Play subscription, mirrored from RevenueCat webhooks).
ALTER TABLE users ADD COLUMN pro_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN pro_product VARCHAR(100);

-- Webhook idempotency: RevenueCat retries deliveries.
CREATE TABLE billing_events (
    id           VARCHAR(100) PRIMARY KEY,
    type         VARCHAR(40) NOT NULL,
    user_id      UUID,
    received_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
