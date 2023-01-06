--select sfm.fen, json_agg(json_build_array(sfm.onehot_move, sfm.count, sfm.hit_soon_total/sfm.count, sfm.result_total/sfm.count, sfm.progress_total/sfm.count)) as moves from scid_fen_moves sfm
--group by sfm.fen

--SELECT fen, onehot_move, count, (hit_soon_total/count)as hit_soon, (result_total/count)as result, (progress_total/count) as progress FROM public.scid_fen_moves x

select
	sfm.fen,
	avg(sfm.progress_total/sfm.count) as progress
	--json_agg(json_build_array(sfm.onehot_move, sfm.count, sfm.hit_soon_total/sfm.count, sfm.result_total::float/sfm.count)) as moves
from scid_fen_moves sfm
--where count>300
group by sfm.fen




--------------


insert into fens_agg (fen,count,hit_soon,result,progress,moves)
select
	sfm.fen,
  sum(sfm.count) as count,
	avg(sfm.hit_soon_total/sfm.count) as hit_soon,
	avg(sfm.result_total::float/sfm.count ) as result,
	avg(sfm.progress_total/sfm.count) as progress,
	json_agg(json_build_array(sfm.onehot_move, sfm.count, sfm.hit_soon_total/sfm.count, sfm.result_total::float/sfm.count)) as moves
from scid_fen_moves sfm
--where count>300
group by sfm.fen