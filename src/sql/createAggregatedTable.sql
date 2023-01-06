CREATE SEQUENCE fens_agg_id_seq;

CREATE TABLE fens_agg (
    id bigint primary key default pseudo_encrypt(nextval('fens_agg_id_seq')),
    fen VARCHAR(90) NOT NULL,
    count INTEGER NOT NULL,
    progress DECIMAL(8, 7) NOT NULL,
    hit_soon DECIMAL(8, 7) NOT NULL DEFAULT 0,
    result DECIMAL(8, 7) NOT NULL DEFAULT 0,
    moves text NOT null
);

ALTER SEQUENCE fens_agg_id_seq OWNED BY fens_agg.id;

---------------------


ALTER TABLE fens_agg
ADD COLUMN progress_total DECIMAL(15, 7) NOT NULL DEFAULT 0,
ADD COLUMN progress_avg DECIMAL(8, 7) NOT NULL DEFAULT 0,
ADD COLUMN hit_soon_total DECIMAL(15, 7) NOT NULL DEFAULT 0,
ADD COLUMN hit_soon_avg DECIMAL(8, 7) NOT NULL DEFAULT 0,
ADD COLUMN result_avg DECIMAL(8, 7) NOT NULL DEFAULT 0,
ADD COLUMN result_total INTEGER NOT NULL DEFAULT 0,
ADD COLUMN count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN balance INTEGER NOT NULL DEFAULT 0,
ADD COLUMN piece_count INTEGER NOT NULL DEFAULT 0,

ADD COLUMN chkmate BOOL,
ADD COLUMN stall BOOL;


---------------

ALTER TABLE fens_agg
--DROP COLUMN progress_total,
--DROP COLUMN progress_avg,
DROP COLUMN hit_soon_total,
DROP COLUMN hit_soon_avg,
DROP COLUMN result_avg,
DROP COLUMN result_total,
DROP COLUMN count,
DROP COLUMN balance,
DROP COLUMN piece_count;

-------------

ALTER TABLE fens_agg ADD CONSTRAINT fen_uique UNIQUE (fen);



---------------

CREATE INDEX fens_agg_progress ON fens_agg(progress);
CREATE INDEX fens_agg_id_progress ON fens_agg(id, progress);
