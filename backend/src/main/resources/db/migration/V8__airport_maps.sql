CREATE TABLE airport_maps (
    iata VARCHAR(3) PRIMARY KEY,
    features TEXT NOT NULL,
    feature_count INT NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL
);
