ALTER TABLE app_user
    ADD COLUMN email VARCHAR(254),
    ADD COLUMN password_hash VARCHAR(100);

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_email_normalized
        CHECK (email IS NULL OR (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)),
    ADD CONSTRAINT chk_app_user_password_hash
        CHECK (password_hash IS NULL OR length(password_hash) BETWEEN 20 AND 100),
    ADD CONSTRAINT chk_app_user_auth_fields_together
        CHECK ((email IS NULL) = (password_hash IS NULL));

CREATE UNIQUE INDEX uq_app_user_email_normalized
    ON app_user (lower(email))
    WHERE email IS NOT NULL;

CREATE TABLE user_session (
    session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_session_user
        FOREIGN KEY (user_id) REFERENCES app_user (user_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT uq_user_session_token_hash UNIQUE (token_hash),
    CONSTRAINT chk_user_session_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_user_session_expiration CHECK (expires_at > created_at),
    CONSTRAINT chk_user_session_revocation CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX idx_user_session_active_lookup
    ON user_session (token_hash, expires_at)
    WHERE revoked_at IS NULL;
