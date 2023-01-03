CREATE TABLE scid_fen_moves (
    fen VARCHAR(90) NOT NULL,
    CONSTRAINT fen FOREIGN KEY(fen) REFERENCES scid_fens(fen),

    onehot_move SMALLINT,
    PRIMARY KEY (fen, onehot_move),

    hit_soon_total DECIMAL(15, 7) NOT NULL,
    chkmate_soon_total DECIMAL(15, 7) NOT NULL,
    progress_total DECIMAL(15, 7) NOT NULL,
    result_total INTEGER NOT NULL,

    count INTEGER NOT NULL
)
