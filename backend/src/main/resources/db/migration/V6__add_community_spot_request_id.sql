ALTER TABLE user_spot
    ADD COLUMN client_request_id UUID;

CREATE UNIQUE INDEX uq_user_spot_user_client_request
    ON user_spot (user_id, client_request_id)
    WHERE client_request_id IS NOT NULL;
