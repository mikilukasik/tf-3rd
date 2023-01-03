DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

CREATE TABLE scid_filenames (
  filename VARCHAR(256) PRIMARY KEY
);

CREATE TABLE scid_fens (
    fen VARCHAR(90) PRIMARY KEY,
    hit_soon_total DECIMAL(15, 7) NOT NULL,
    chkmate_soon_total DECIMAL(15, 7) NOT NULL,
    progress_total DECIMAL(15, 7) NOT NULL,
    result_total INTEGER NOT NULL,
    hit_soon_avg DECIMAL(8, 7) NOT NULL,
    chkmate_soon_avg DECIMAL(8, 7) NOT NULL,
    progress_avg DECIMAL(8, 7) NOT NULL,
    result_avg DECIMAL(8, 7) NOT NULL,
    count INTEGER NOT NULL,
    balance SMALLINT NOT NULL,
    piece_count SMALLINT NOT NULL,
    chkmate BOOL NOT NULL,
    stall BOOL NOT NULL,
    test BOOL NOT NULL
);

CREATE TABLE scid_fen_moves (
    rnd DECIMAL(8, 7) NOT NULL,
    fen VARCHAR(90) NOT NULL,
    -- CONSTRAINT fen FOREIGN KEY(fen) REFERENCES scid_fens(fen),
    onehot_move SMALLINT,

    PRIMARY KEY (fen, onehot_move),
    hit_soon_total DECIMAL(15, 7) NOT NULL,
    chkmate_soon_total DECIMAL(15, 7) NOT NULL,
    result_total INTEGER NOT NULL,
    hit_soon_avg DECIMAL(8, 7) NOT NULL,
    chkmate_soon_avg DECIMAL(8, 7) NOT NULL,
    result_avg DECIMAL(8, 7) NOT NULL,
    count INTEGER NOT NULL
);

--CREATE INDEX scid_fen_moves_fen ON scid_fen_moves(fen);
--CREATE INDEX scid_fen_moves_rnd ON scid_fen_moves(rnd);

--DROP INDEX scid_fen_moves_fen;
--DROP INDEX scid_fen_moves_rnd;