CREATE TABLE scid_games (
    filename VARCHAR(255) PRIMARY KEY,
    
    white_won BOOL NOT NULL,
    black_won BOOL NOT NULL,
    draw BOOL NOT NULL,

    chkmate_ending BOOL NOT NULL,
    stall_ending BOOL NOT NULL,
    aborted_ending BOOL NOT NULL,

    total_moves SMALLINT NOT NULL,

    rnd FLOAT(16)
)

