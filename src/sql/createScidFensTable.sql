CREATE TABLE scid_fens (
    fen VARCHAR(90) PRIMARY KEY,

    hit_soon_total DECIMAL(15, 7) NOT NULL,
    chkmate_soon_total DECIMAL(15, 7) NOT NULL,
    progress_total DECIMAL(15, 7) NOT NULL,
    result_total INTEGER NOT NULL,

    count INTEGER NOT NULL,


    balance SMALLINT NOT NULL,
    piece_count SMALLINT NOT NULL,
   

    chkmate BOOL NOT NULL,
    stall BOOL NOT NULL,

    test BOOL NOT NULL
)
