import h3
from raksha_pipeline import region


def test_chunk_grid_covers_the_bbox_without_gaps_or_overlap():
    bbox = [21.0, 74.0, 22.0, 75.0]
    chunks = region.chunk_grid(bbox, 0.25)
    assert len(chunks) == 16
    assert min(c[0] for c in chunks) == 21.0 and max(c[2] for c in chunks) == 22.0 and max(c[3] for c in chunks) == 75.0
    # every point belongs to exactly one chunk core (edges are half-open), so no cell is emitted twice
    for lat, lng in [(21.0, 74.0), (21.25, 74.25), (21.9999, 74.9999), (21.5, 74.75)]:
        assert sum(region.in_core(lat, lng, c) for c in chunks) == 1


def test_ragged_bbox_is_clipped_to_the_edge():
    chunks = region.chunk_grid([0, 0, 0.3, 0.3], 0.25)
    assert len(chunks) == 4 and max(c[2] for c in chunks) == 0.3 and max(c[3] for c in chunks) == 0.3


def test_tiles_group_cells_and_spots_by_res5_parent():
    a = h3.latlng_to_cell(19.2, 72.85, 9); b = h3.latlng_to_cell(18.5, 73.85, 9)          # Mumbai, Pune
    rows = [[a, [50, 50, 50], 1, 0, 0], [b, [60, 60, 60], 2, 0, 0], [h3.grid_ring(a, 1)[0], [55, 55, 55], 1, 0, 0]]
    spots = [{"kind": "police", "name": "PS", "lat": 19.2, "lng": 72.85, "h3": a}]
    tiles = region.group_into_tiles(rows, spots)
    assert set(tiles) == {h3.cell_to_parent(a, 5), h3.cell_to_parent(b, 5)}
    assert sum(len(t["cells"]) for t in tiles.values()) == 3
    assert tiles[h3.cell_to_parent(a, 5)]["spots"] == spots and tiles[h3.cell_to_parent(b, 5)]["spots"] == []


def test_tile_size_is_a_few_hundred_square_km():
    assert 150 < h3.cell_area(h3.latlng_to_cell(19.2, 72.85, region.TILE_RES), "km^2") < 300
