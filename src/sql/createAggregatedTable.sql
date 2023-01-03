CREATE SEQUENCE mytable_id_seq;

CREATE TABLE mytable (
    id bigint primary key default pseudo_encrypt(nextval('mytable_id_seq')),
    fen VARCHAR(90) NOT NULL,
        moves text NOT null

);

ALTER SEQUENCE mytable_id_seq OWNED BY mytable.id;

---------------------


ALTER TABLE mytable
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

ALTER TABLE mytable
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

ALTER TABLE mytable ADD CONSTRAINT fen_uique UNIQUE (fen);
