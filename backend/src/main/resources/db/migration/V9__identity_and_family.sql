ALTER TABLE users ADD COLUMN identity_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN identity_doc_type VARCHAR(2);
ALTER TABLE users ADD COLUMN identity_country VARCHAR(3);
ALTER TABLE users ADD COLUMN identity_expiry DATE;
ALTER TABLE users ADD COLUMN identity_doc_hash VARCHAR(64);
CREATE UNIQUE INDEX ux_users_identity_doc ON users (identity_doc_hash);

CREATE TABLE companions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    relation VARCHAR(20) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    doc_country VARCHAR(3),
    doc_expiry DATE,
    doc_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_companions_owner ON companions (owner_id);

ALTER TABLE flights ADD COLUMN passengers_json TEXT;
