-- Seed Rip City facility
insert into facilities (name, slug, primary_color, secondary_color)
values ('Rip City', 'rip-city', '#ffffff', '#000000')
on conflict (slug) do nothing;

-- Seed Rip City groups
insert into groups (facility_id, name, group_type, member_type)
select id, 'H2K', 'h2k', 'h2k'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, '12-13', 'age', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, '14-15', 'age', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, '16-18', 'age', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into groups (facility_id, name, group_type, member_type)
select id, 'Older Elite', 'program', 'athlete'
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

-- Seed H2K habits
insert into habits (facility_id, name, description, points_per_day)
select id, 'Sleep 7+ hours', 'Complete if you slept at least 7 hours.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Training', 'Complete if you trained or completed your assigned physical work.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Order of Environment', 'Complete if you kept your room, schedule, or environment organized.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Skill Development', 'Complete if you worked on improving a skill.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Relationship Building', 'Complete if you intentionally built or strengthened a relationship.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;

insert into habits (facility_id, name, description, points_per_day)
select id, 'Handling Responsibilities', 'Complete if you handled your responsibilities for the day.', 1
from facilities
where slug = 'rip-city'
on conflict (facility_id, name) do nothing;