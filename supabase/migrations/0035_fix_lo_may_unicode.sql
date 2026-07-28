-- Repair Lò Mây display name after an earlier migration was saved with the
-- wrong text encoding on Windows.

update catalog.makers
set display_name = U&'L\00F2 M\00E2y',
    updated_at = now()
where slug = 'lo-may';
