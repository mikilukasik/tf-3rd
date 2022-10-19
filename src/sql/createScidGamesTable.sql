CREATE TABLE scid_games (
    filename VARCHAR(255) PRIMARY KEY,
    
    result SMALLINT NOT NULL,

    chkmate_ending BOOL NOT NULL,
    stall_ending BOOL NOT NULL,
    aborted_ending BOOL NOT NULL,

    total_moves SMALLINT NOT NULL
)

