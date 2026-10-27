-- Gatemate schema. Portable SQL (PostgreSQL in production, H2 in tests).

CREATE TABLE users (
    id                  UUID PRIMARY KEY,
    email               VARCHAR(254) NOT NULL UNIQUE,
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash       VARCHAR(255),
    display_name        VARCHAR(60) NOT NULL,
    legal_first_name    VARCHAR(40),
    legal_last_name     VARCHAR(40),
    phone               VARCHAR(16),
    home_airport        VARCHAR(3),
    seat_preference     VARCHAR(16),
    bio                 VARCHAR(160),
    avatar_url          TEXT,
    avatar_color        VARCHAR(9) NOT NULL,
    provider            VARCHAR(10) NOT NULL,
    apple_sub           VARCHAR(255) UNIQUE,
    google_sub          VARCHAR(255) UNIQUE,
    apple_refresh_token TEXT,
    import_token        VARCHAR(32) NOT NULL UNIQUE,
    role                VARCHAR(10) NOT NULL DEFAULT 'USER',
    banned              BOOLEAN NOT NULL DEFAULT FALSE,
    failed_logins       INTEGER NOT NULL DEFAULT 0,
    locked_until        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    family_id   UUID NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at  TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_refresh_family ON refresh_tokens (family_id);
CREATE INDEX ix_refresh_user ON refresh_tokens (user_id);

CREATE TABLE password_resets (
    token_hash  VARCHAR(64) PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE
);

CREATE TABLE trips (
    id                UUID PRIMARY KEY,
    owner_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title             VARCHAR(80) NOT NULL,
    destination_iata  VARCHAR(3) NOT NULL,
    start_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    chat_id           UUID,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_members (
    trip_id  UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role     VARCHAR(10) NOT NULL,
    PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE flights (
    id                UUID PRIMARY KEY,
    trip_id           UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    claimed_by        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    airline_code      VARCHAR(3) NOT NULL,
    airline_name      VARCHAR(60) NOT NULL,
    flight_number     VARCHAR(10) NOT NULL,
    from_iata         VARCHAR(3) NOT NULL,
    to_iata           VARCHAR(3) NOT NULL,
    departure_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    boarding_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    gate              VARCHAR(8),
    terminal          VARCHAR(8),
    seat              VARCHAR(5),
    cabin             VARCHAR(10) NOT NULL,
    booking_ref       VARCHAR(8),
    passenger_name    VARCHAR(60) NOT NULL,
    status            VARCHAR(12) NOT NULL,
    fare_name         VARCHAR(40),
    baggage_json      TEXT,
    verification_json TEXT,
    claim_key         VARCHAR(200) UNIQUE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_flights_trip ON flights (trip_id);
CREATE INDEX ix_flights_departure ON flights (departure_at);

CREATE TABLE checklist_items (
    id        UUID PRIMARY KEY,
    trip_id   UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    label     VARCHAR(80) NOT NULL,
    done      BOOLEAN NOT NULL DEFAULT FALSE,
    category  VARCHAR(12) NOT NULL,
    position  INTEGER NOT NULL
);

CREATE TABLE expenses (
    id            UUID PRIMARY KEY,
    trip_id       UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    label         VARCHAR(60) NOT NULL,
    amount_cents  BIGINT NOT NULL,
    currency      VARCHAR(3) NOT NULL,
    paid_by       UUID NOT NULL,
    split_with    TEXT NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        VARCHAR(12) NOT NULL,
    title       VARCHAR(120) NOT NULL,
    body        VARCHAR(500) NOT NULL,
    flight_id   UUID,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_alerts_user ON alerts (user_id, created_at);

CREATE TABLE chat_threads (
    id          UUID PRIMARY KEY,
    title       VARCHAR(60) NOT NULL,
    emoji       VARCHAR(16) NOT NULL,
    trip_id     UUID,
    is_public   BOOLEAN NOT NULL DEFAULT FALSE,
    lounge_key  VARCHAR(40) UNIQUE,
    created_by  UUID,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_members (
    thread_id    UUID NOT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    muted        BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE chat_messages (
    id            UUID PRIMARY KEY,
    thread_id     UUID NOT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
    author_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text          VARCHAR(1000) NOT NULL,
    client_id     VARCHAR(64) NOT NULL,
    flagged       BOOLEAN NOT NULL DEFAULT FALSE,
    hidden        BOOLEAN NOT NULL DEFAULT FALSE,
    report_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_message_client UNIQUE (author_id, client_id)
);
CREATE INDEX ix_messages_thread ON chat_messages (thread_id, created_at);

CREATE TABLE blocks (
    blocker_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE reports (
    id           UUID PRIMARY KEY,
    reporter_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id   UUID NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    reason       VARCHAR(60) NOT NULL,
    status       VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at  TIMESTAMP WITH TIME ZONE,
    resolved_by  UUID,
    CONSTRAINT uq_report UNIQUE (reporter_id, message_id)
);

CREATE TABLE invites (
    id           UUID PRIMARY KEY,
    token_hash   VARCHAR(64) NOT NULL UNIQUE,
    target_type  VARCHAR(8) NOT NULL,
    target_id    UUID NOT NULL,
    created_by   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    used_by      UUID,
    used_at      TIMESTAMP WITH TIME ZONE
);

CREATE TABLE feedback (
    id             UUID PRIMARY KEY,
    user_id        UUID REFERENCES users (id) ON DELETE SET NULL,
    topic          VARCHAR(40) NOT NULL,
    message        VARCHAR(1000) NOT NULL,
    rating         INTEGER,
    contact_email  VARCHAR(254),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE push_tokens (
    token       VARCHAR(512) PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform    VARCHAR(8) NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
