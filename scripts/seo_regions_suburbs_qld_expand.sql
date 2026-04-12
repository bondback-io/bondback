-- =============================================================================
-- Bond Back: Additional QLD regions + suburbs for Admin SEO
-- =============================================================================
-- Run in Supabase SQL Editor AFTER scripts/seo_regions_suburbs_migration.sql
-- Idempotent (ON CONFLICT). Adds 11 regions and priority suburbs each.
-- =============================================================================

INSERT INTO public.seo_regions (name, slug, is_active)
VALUES
  ('Gold Coast QLD', 'gold-coast', true),
  ('Ipswich QLD', 'ipswich', true),
  ('Logan QLD', 'logan', true),
  ('Redlands QLD', 'redlands', true),
  ('Toowoomba QLD', 'toowoomba', true),
  ('Wide Bay QLD', 'wide-bay', true),
  ('Gladstone QLD', 'gladstone', true),
  ('Rockhampton QLD', 'rockhampton', true),
  ('Mackay QLD', 'mackay', true),
  ('Townsville QLD', 'townsville', true),
  ('Cairns QLD', 'cairns', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- Gold Coast — 25 suburbs (priority 1 = highest)
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Surfers Paradise', '4217', 'surfers-paradise', 1),
  ('Southport', '4215', 'southport', 2),
  ('Broadbeach', '4218', 'broadbeach', 3),
  ('Burleigh Heads', '4220', 'burleigh-heads', 4),
  ('Robina', '4226', 'robina', 5),
  ('Coolangatta', '4225', 'coolangatta', 6),
  ('Palm Beach', '4221', 'palm-beach', 7),
  ('Varsity Lakes', '4227', 'varsity-lakes', 8),
  ('Nerang', '4211', 'nerang', 9),
  ('Coomera', '4209', 'coomera', 10),
  ('Hope Island', '4212', 'hope-island', 11),
  ('Helensvale', '4212', 'helensvale', 12),
  ('Mermaid Beach', '4218', 'mermaid-beach', 13),
  ('Labrador', '4215', 'labrador', 14),
  ('Runaway Bay', '4216', 'runaway-bay', 15),
  ('Arundel', '4214', 'arundel', 16),
  ('Pacific Pines', '4211', 'pacific-pines', 17),
  ('Oxenford', '4210', 'oxenford', 18),
  ('Upper Coomera', '4209', 'upper-coomera', 19),
  ('Burleigh Waters', '4220', 'burleigh-waters', 20),
  ('Miami', '4220', 'miami', 21),
  ('Currumbin', '4223', 'currumbin', 22),
  ('Tugun', '4224', 'tugun', 23),
  ('Biggera Waters', '4216', 'biggera-waters', 24),
  ('Elanora', '4221', 'elanora', 25)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'gold-coast'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Ipswich — 20 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Ipswich', '4305', 'ipswich', 1),
  ('Springfield Central', '4300', 'springfield-central', 2),
  ('Redbank Plains', '4301', 'redbank-plains', 3),
  ('Goodna', '4300', 'goodna', 4),
  ('Bundamba', '4304', 'bundamba', 5),
  ('Booval', '4304', 'booval', 6),
  ('East Ipswich', '4305', 'east-ipswich', 7),
  ('Springfield Lakes', '4300', 'springfield-lakes', 8),
  ('Ripley', '4306', 'ripley', 9),
  ('Redbank', '4301', 'redbank', 10),
  ('Bellbird Park', '4300', 'bellbird-park', 11),
  ('Camira', '4300', 'camira', 12),
  ('Gailes', '4300', 'gailes', 13),
  ('Karalee', '4306', 'karalee', 14),
  ('Rosewood', '4340', 'rosewood', 15),
  ('Laidley', '4341', 'laidley', 16),
  ('Plainland', '4341', 'plainland', 17),
  ('Fernvale', '4306', 'fernvale', 18),
  ('Willowbank', '4306', 'willowbank', 19),
  ('Wulkuraka', '4305', 'wulkuraka', 20)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'ipswich'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Logan — 20 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Logan Central', '4114', 'logan-central', 1),
  ('Beenleigh', '4207', 'beenleigh', 2),
  ('Springwood', '4127', 'springwood', 3),
  ('Shailer Park', '4128', 'shailer-park', 4),
  ('Loganlea', '4131', 'loganlea', 5),
  ('Browns Plains', '4118', 'browns-plains', 6),
  ('Marsden', '4132', 'marsden', 7),
  ('Waterford', '4133', 'waterford', 8),
  ('Kingston', '4114', 'kingston', 9),
  ('Slacks Creek', '4127', 'slacks-creek', 10),
  ('Daisy Hill', '4127', 'daisy-hill', 11),
  ('Woodridge', '4114', 'woodridge', 12),
  ('Bethania', '4205', 'bethania', 13),
  ('Edens Landing', '4207', 'edens-landing', 14),
  ('Eagleby', '4207', 'eagleby', 15),
  ('Jimboomba', '4280', 'jimboomba', 16),
  ('Park Ridge', '4125', 'park-ridge', 17),
  ('Crestmead', '4132', 'crestmead', 18),
  ('Heritage Park', '4118', 'heritage-park', 19),
  ('Hillcrest', '4118', 'hillcrest', 20)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'logan'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Redlands — 15 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Cleveland', '4163', 'cleveland', 1),
  ('Victoria Point', '4165', 'victoria-point', 2),
  ('Capalaba', '4157', 'capalaba', 3),
  ('Thornlands', '4164', 'thornlands', 4),
  ('Redland Bay', '4165', 'redland-bay', 5),
  ('Alexandra Hills', '4161', 'alexandra-hills', 6),
  ('Birkdale', '4159', 'birkdale', 7),
  ('Wellington Point', '4160', 'wellington-point', 8),
  ('Ormiston', '4160', 'ormiston', 9),
  ('Mount Cotton', '4165', 'mount-cotton', 10),
  ('Sheldon', '4154', 'sheldon', 11),
  ('Dunwich', '4183', 'dunwich', 12),
  ('Point Lookout', '4183', 'point-lookout', 13),
  ('Russell Island', '4184', 'russell-island', 14),
  ('Macleay Island', '4184', 'macleay-island', 15)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'redlands'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Toowoomba — 20 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Toowoomba', '4350', 'toowoomba', 1),
  ('Highfields', '4352', 'highfields', 2),
  ('Darling Heights', '4350', 'darling-heights', 3),
  ('Rangeville', '4350', 'rangeville', 4),
  ('Middle Ridge', '4350', 'middle-ridge', 5),
  ('Wilsonton', '4350', 'wilsonton', 6),
  ('Glenvale', '4350', 'glenvale', 7),
  ('Westbrook', '4350', 'westbrook', 8),
  ('Harristown', '4350', 'harristown', 9),
  ('Newtown', '4350', 'newtown', 10),
  ('North Toowoomba', '4350', 'north-toowoomba', 11),
  ('South Toowoomba', '4350', 'south-toowoomba', 12),
  ('East Toowoomba', '4350', 'east-toowoomba', 13),
  ('Kleinton', '4352', 'kleinton', 14),
  ('Oakey', '4401', 'oakey', 15),
  ('Pittsworth', '4356', 'pittsworth', 16),
  ('Warwick', '4370', 'warwick', 17),
  ('Stanthorpe', '4380', 'stanthorpe', 18),
  ('Gatton', '4343', 'gatton', 19),
  ('Withcott', '4352', 'withcott', 20)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'toowoomba'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Wide Bay — 20 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Bundaberg', '4670', 'bundaberg', 1),
  ('Hervey Bay', '4655', 'hervey-bay', 2),
  ('Maryborough', '4650', 'maryborough', 3),
  ('Bargara', '4670', 'bargara', 4),
  ('Burnett Heads', '4670', 'burnett-heads', 5),
  ('Innes Park', '4670', 'innes-park', 6),
  ('Coral Cove', '4670', 'coral-cove', 7),
  ('Eli Waters', '4655', 'eli-waters', 8),
  ('Pialba', '4655', 'pialba', 9),
  ('Urangan', '4655', 'urangan', 10),
  ('Torquay', '4655', 'torquay', 11),
  ('Scarness', '4655', 'scarness', 12),
  ('Maryborough West', '4650', 'maryborough-west', 13),
  ('Childers', '4660', 'childers', 14),
  ('Gayndah', '4625', 'gayndah', 15),
  ('Kingaroy', '4610', 'kingaroy', 16),
  ('Moore Park Beach', '4670', 'moore-park-beach', 17),
  ('Svensson Heights', '4670', 'svensson-heights', 18),
  ('Avoca', '4670', 'avoca', 19),
  ('Kalkie', '4670', 'kalkie', 20)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'wide-bay'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Gladstone — 12 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Gladstone', '4680', 'gladstone', 1),
  ('Boyne Island', '4680', 'boyne-island', 2),
  ('Tannum Sands', '4680', 'tannum-sands', 3),
  ('Calliope', '4680', 'calliope', 4),
  ('Kin Kora', '4680', 'kin-kora', 5),
  ('South Gladstone', '4680', 'south-gladstone', 6),
  ('West Gladstone', '4680', 'west-gladstone', 7),
  ('Clinton', '4680', 'clinton', 8),
  ('Kirkwood', '4680', 'kirkwood', 9),
  ('New Auckland', '4680', 'new-auckland', 10),
  ('Toolooa', '4680', 'toolooa', 11),
  ('Benaraby', '4680', 'benaraby', 12)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'gladstone'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Rockhampton — 15 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Rockhampton', '4700', 'rockhampton', 1),
  ('Yeppoon', '4703', 'yeppoon', 2),
  ('Emu Park', '4710', 'emu-park', 3),
  ('Gracemere', '4702', 'gracemere', 4),
  ('Parkhurst', '4702', 'parkhurst', 5),
  ('Allenstown', '4700', 'allenstown', 6),
  ('North Rockhampton', '4701', 'north-rockhampton', 7),
  ('West Rockhampton', '4700', 'west-rockhampton', 8),
  ('Frenchville', '4701', 'frenchville', 9),
  ('Kawana', '4701', 'kawana', 10),
  ('Park Avenue', '4701', 'park-avenue', 11),
  ('Berserker', '4701', 'berserker', 12),
  ('Wandal', '4700', 'wandal', 13),
  ('The Range', '4700', 'the-range', 14),
  ('Mount Morgan', '4714', 'mount-morgan', 15)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'rockhampton'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Mackay — 18 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Mackay', '4740', 'mackay', 1),
  ('Sarina', '4737', 'sarina', 2),
  ('Andergrove', '4740', 'andergrove', 3),
  ('North Mackay', '4740', 'north-mackay', 4),
  ('South Mackay', '4740', 'south-mackay', 5),
  ('West Mackay', '4740', 'west-mackay', 6),
  ('Marian', '4753', 'marian', 7),
  ('Walkerston', '4751', 'walkerston', 8),
  ('Finch Hatton', '4756', 'finch-hatton', 9),
  ('Airlie Beach', '4802', 'airlie-beach', 10),
  ('Cannonvale', '4802', 'cannonvale', 11),
  ('Proserpine', '4800', 'proserpine', 12),
  ('Bowen', '4805', 'bowen', 13),
  ('Eimeo', '4740', 'eimeo', 14),
  ('Bucasia', '4740', 'bucasia', 15),
  ('Blacks Beach', '4740', 'blacks-beach', 16),
  ('Slade Point', '4740', 'slade-point', 17),
  ('Beaconsfield', '4740', 'beaconsfield', 18)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'mackay'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Townsville — 20 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Townsville', '4810', 'townsville', 1),
  ('Kirwan', '4817', 'kirwan', 2),
  ('Thuringowa Central', '4817', 'thuringowa-central', 3),
  ('Douglas', '4814', 'douglas', 4),
  ('Annandale', '4814', 'annandale', 5),
  ('Heatley', '4814', 'heatley', 6),
  ('Vincent', '4814', 'vincent', 7),
  ('Gulliver', '4812', 'gulliver', 8),
  ('Hyde Park', '4812', 'hyde-park', 9),
  ('Pimlico', '4812', 'pimlico', 10),
  ('Hermit Park', '4812', 'hermit-park', 11),
  ('Castle Hill', '4810', 'castle-hill', 12),
  ('North Ward', '4810', 'north-ward', 13),
  ('South Townsville', '4810', 'south-townsville', 14),
  ('Belgian Gardens', '4810', 'belgian-gardens', 15),
  ('Ayr', '4807', 'ayr', 16),
  ('Home Hill', '4806', 'home-hill', 17),
  ('Charters Towers', '4820', 'charters-towers', 18),
  ('Ingham', '4850', 'ingham', 19),
  ('Deeragun', '4818', 'deeragun', 20)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'townsville'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;

-- Cairns — 20 suburbs
INSERT INTO public.seo_suburbs (region_id, suburb_name, postcode, slug, priority, completed)
SELECT r.id, v.suburb_name, v.postcode, v.slug, v.priority, false
FROM public.seo_regions r
CROSS JOIN (VALUES
  ('Cairns', '4870', 'cairns', 1),
  ('Cairns North', '4870', 'cairns-north', 2),
  ('Port Douglas', '4877', 'port-douglas', 3),
  ('Palm Cove', '4879', 'palm-cove', 4),
  ('Trinity Beach', '4879', 'trinity-beach', 5),
  ('Kewarra Beach', '4879', 'kewarra-beach', 6),
  ('Clifton Beach', '4879', 'clifton-beach', 7),
  ('Edmonton', '4869', 'edmonton', 8),
  ('Gordonvale', '4865', 'gordonvale', 9),
  ('White Rock', '4868', 'white-rock', 10),
  ('Mount Sheridan', '4868', 'mount-sheridan', 11),
  ('Smithfield', '4878', 'smithfield', 12),
  ('Redlynch', '4870', 'redlynch', 13),
  ('Mooroobool', '4870', 'mooroobool', 14),
  ('Manoora', '4870', 'manoora', 15),
  ('Westcourt', '4870', 'westcourt', 16),
  ('Manunda', '4870', 'manunda', 17),
  ('Bungalow', '4870', 'bungalow', 18),
  ('Bentley Park', '4865', 'bentley-park', 19),
  ('Yorkeys Knob', '4878', 'yorkeys-knob', 20)
) AS v(suburb_name, postcode, slug, priority)
WHERE r.slug = 'cairns'
ON CONFLICT (region_id, slug) DO UPDATE SET
  suburb_name = EXCLUDED.suburb_name,
  postcode = EXCLUDED.postcode,
  priority = EXCLUDED.priority;
