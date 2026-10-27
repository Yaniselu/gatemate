-- Server-generated secrets (e.g. the JWT signing key), encrypted with TOKEN_ENCRYPTION_KEY (AES-256-GCM).
CREATE TABLE server_keys (
    id          VARCHAR(40) PRIMARY KEY,
    secret      TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
