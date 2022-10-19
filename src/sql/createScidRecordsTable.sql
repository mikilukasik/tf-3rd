CREATE TABLE scid_records (
    ID  SERIAL PRIMARY KEY,

    fen VARCHAR(90) NOT NULL,
    movestr VARCHAR(6),
    onehot_move SMALLINT,

    hit_soon DECIMAL(16 ,15) NOT NULL,
    chkmate_soon DECIMAL(16 ,15) NOT NULL,
    
    result SMALLINT NOT NULL,
    won BOOL NOT NULL,
    lost BOOL NOT NULL,
    draw BOOL NOT NULL,

    chkmate_ending BOOL NOT NULL,
    stall_ending BOOL NOT NULL,
    aborted_ending BOOL NOT NULL,

    balance SMALLINT NOT NULL,
    piece_count SMALLINT NOT NULL,
    hits_left SMALLINT NOT NULL,

     is_opening BOOL NOT NULL,
    is_midgame BOOL NOT NULL,
    is_endgame BOOL NOT NULL,

    move_index SMALLINT NOT NULL,
    total_moves SMALLINT NOT NULL,
    is_last BOOL NOT NULL,

    lmf SMALLINT[64] NOT NULL,
    lmt SMALLINT[64] NOT NULL,

    version SMALLINT NOT NULL,

    rnd FLOAT(16),
    test BOOL,
   
    filename VARCHAR(255),

    CONSTRAINT filename FOREIGN KEY(filename) REFERENCES scid_games(filename)
)

