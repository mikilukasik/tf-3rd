CREATE TABLE scid_records (
    ID  SERIAL PRIMARY KEY,

    orig_fen VARCHAR(90) NOT NULL,
    fen VARCHAR(90) NOT NULL,

    move_from SMALLINT NOT NULL,
    move_to SMALLINT NOT NULL,
    becomes_knight BOOL NOT NULL,
    resign_now BOOL NOT NULL,

    lmf SMALLINT[64] NOT NULL,
    lmt SMALLINT[64] NOT NULL,

    all_moves SMALLINT[],
    
    won BOOL NOT NULL,
    lost BOOL NOT NULL,
    draw BOOL NOT NULL,

    chkmate_ending BOOL NOT NULL,
    stall_ending BOOL NOT NULL,
    aborted_ending BOOL NOT NULL,
    is_last BOOL NOT NULL,

    -- is_opening BOOL NOT NULL,
    -- is_midgame BOOL NOT NULL,
    -- is_endgame BOOL NOT NULL,

    move_index SMALLINT NOT NULL,
    total_moves SMALLINT NOT NULL,
    
    balance DECIMAL(16 ,15) NOT NULL,
    piece_sum DECIMAL(16 ,15) NOT NULL,
    piece_count SMALLINT NOT NULL,
    hits_left SMALLINT NOT NULL,

    hit_soon DECIMAL(16 ,15) NOT NULL,
    chkmate_soon DECIMAL(16 ,15) NOT NULL,
    
    rnd FLOAT(16),
    test BOOL,

    filename VARCHAR(255),

    -- FOREIGN KEY (filename) REFERENCES scid_games(filename)
    CONSTRAINT filename FOREIGN KEY(filename) REFERENCES scid_games(filename)
)

