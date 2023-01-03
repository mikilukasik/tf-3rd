select sfm.fen, json_agg(json_build_array(sfm.onehot_move, sfm.count, sfm.hit_soon_avg, sfm.result_avg)) as moves from scid_fen_moves sfm
group by sfm.fen