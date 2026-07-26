-- =====================================================
-- RIP CITY STARTER EXERCISE LIBRARY V1
-- =====================================================
-- Proposed seed migration only. Do not run from Codex.
--
-- Run after sql/exercise_library_v1.sql.
--
-- Purpose:
-- - Give coaches a strong starter list of exercises for workout building.
-- - Coaches can still add their own facility-specific exercises in the app.
-- - This intentionally is not "every possible exercise"; it is a broad,
--   practical beta library for Rip City strength, speed, mobility, arm care,
--   H2K, and general athletic development.

with rip_city as (
  select id as facility_id
  from public.facilities
  where slug = 'rip-city'
),
starter_exercises(name, category, equipment, movement_pattern, input_type, description) as (
  values
    ('Trap Bar Deadlift', 'Strength', 'Trap bar', 'Hinge', 'weight_reps', 'Full-body strength hinge. Keep the ribs down, push the floor away, and finish tall.'),
    ('Barbell Deadlift', 'Strength', 'Barbell', 'Hinge', 'weight_reps', 'Hinge from the hips with a braced trunk and smooth bar path.'),
    ('Romanian Deadlift', 'Strength', 'Barbell or dumbbells', 'Hinge', 'weight_reps', 'Control the lowering phase and keep tension through hamstrings and glutes.'),
    ('Single-Leg RDL', 'Strength', 'Dumbbell or kettlebell', 'Single-leg hinge', 'weight_reps', 'Reach long through the back leg and keep hips square.'),
    ('Kettlebell Swing', 'Power', 'Kettlebell', 'Hinge', 'weight_reps', 'Explosive hip snap with a neutral spine and relaxed arms.'),
    ('Back Squat', 'Strength', 'Barbell', 'Squat', 'weight_reps', 'Brace, sit between the hips, and drive evenly through both feet.'),
    ('Front Squat', 'Strength', 'Barbell', 'Squat', 'weight_reps', 'Tall torso squat with elbows high and a strong brace.'),
    ('Goblet Squat', 'Strength', 'Dumbbell or kettlebell', 'Squat', 'weight_reps', 'Use as a clean squat pattern with depth and control.'),
    ('Split Squat', 'Strength', 'Dumbbells', 'Single-leg squat', 'weight_reps', 'Lower under control and drive through the front foot.'),
    ('Rear-Foot Elevated Split Squat', 'Strength', 'Bench and dumbbells', 'Single-leg squat', 'weight_reps', 'Single-leg strength with a stable front knee and tall posture.'),
    ('Lateral Lunge', 'Strength', 'Bodyweight or dumbbells', 'Lateral squat', 'weight_reps', 'Shift into one hip while the opposite leg stays long.'),
    ('Reverse Lunge', 'Strength', 'Bodyweight or dumbbells', 'Single-leg squat', 'weight_reps', 'Step back under control and drive through the front leg.'),
    ('Step-Up', 'Strength', 'Box and dumbbells', 'Single-leg squat', 'weight_reps', 'Use the working leg to stand tall without pushing off the back foot.'),
    ('Hip Thrust', 'Strength', 'Barbell or bodyweight', 'Hip extension', 'weight_reps', 'Finish with glutes, not low back.'),
    ('Glute Bridge', 'Activation', 'Bodyweight or band', 'Hip extension', 'completion', 'Create glute tension and keep ribs down.'),

    ('Bench Press', 'Strength', 'Barbell', 'Horizontal push', 'weight_reps', 'Controlled press with stable shoulders and strong leg drive.'),
    ('Dumbbell Bench Press', 'Strength', 'Dumbbells', 'Horizontal push', 'weight_reps', 'Press with even tempo and shoulder control.'),
    ('Incline Dumbbell Press', 'Strength', 'Dumbbells', 'Upper push', 'weight_reps', 'Press on an incline while keeping ribs down.'),
    ('Push-Up', 'Strength', 'Bodyweight', 'Horizontal push', 'completion', 'Straight body line, controlled lower, strong lockout.'),
    ('Tempo Push-Up', 'Strength', 'Bodyweight', 'Horizontal push', 'completion', 'Slow controlled lowering to build strength and position.'),
    ('Landmine Press', 'Strength', 'Landmine', 'Angled push', 'weight_reps', 'Press up and forward with trunk control.'),
    ('Half-Kneeling DB Press', 'Strength', 'Dumbbell', 'Vertical push', 'weight_reps', 'Press overhead from a stable half-kneeling position.'),
    ('Med Ball Chest Pass', 'Power', 'Medicine ball', 'Upper power', 'distance', 'Explosive chest pass with full-body intent.'),
    ('Med Ball Shot Put', 'Power', 'Medicine ball', 'Rotational power', 'distance', 'Rotate through the hips and throw with intent.'),
    ('Med Ball Slam', 'Power', 'Medicine ball', 'Total-body power', 'completion', 'Reach tall, slam hard, and reset each rep.'),

    ('Pull-Up', 'Strength', 'Pull-up bar', 'Vertical pull', 'completion', 'Pull with controlled shoulders and full-body tension.'),
    ('Assisted Pull-Up', 'Strength', 'Band or machine', 'Vertical pull', 'band_color', 'Use the lightest assistance that allows clean reps.'),
    ('Lat Pulldown', 'Strength', 'Cable machine', 'Vertical pull', 'weight_reps', 'Pull elbows down with a tall chest and quiet ribs.'),
    ('Seated Cable Row', 'Strength', 'Cable machine', 'Horizontal pull', 'weight_reps', 'Pull shoulder blades back without leaning through the torso.'),
    ('Chest-Supported Row', 'Strength', 'Bench and dumbbells', 'Horizontal pull', 'weight_reps', 'Keep chest supported and pull elbows toward hips.'),
    ('Single-Arm DB Row', 'Strength', 'Dumbbell', 'Horizontal pull', 'weight_reps', 'Row with control and avoid twisting.'),
    ('Band Row', 'Strength', 'Band', 'Horizontal pull', 'band_color', 'Squeeze shoulder blades back and control the return.'),
    ('Face Pull', 'Shoulder Health', 'Cable or band', 'Scapular control', 'weight_reps', 'Pull toward the face with elbows high and shoulder control.'),
    ('Band Pull-Apart', 'Shoulder Health', 'Band', 'Scapular control', 'band_color', 'Keep arms long and squeeze upper back.'),

    ('Box Jump', 'Power', 'Box', 'Jump', 'completion', 'Jump explosively and land quietly with control.'),
    ('Broad Jump', 'Power', 'Bodyweight', 'Jump', 'distance', 'Jump forward with full intent and stick the landing.'),
    ('Skater Jump', 'Power', 'Bodyweight', 'Lateral jump', 'completion', 'Drive side to side and land stable on one leg.'),
    ('Pogo Jump', 'Elasticity', 'Bodyweight', 'Ankle stiffness', 'completion', 'Quick contacts through the balls of the feet.'),
    ('Snap Down', 'Landing', 'Bodyweight', 'Landing mechanics', 'completion', 'Drop quickly into an athletic position and stick the landing.'),
    ('Depth Drop', 'Landing', 'Box', 'Landing mechanics', 'completion', 'Step off, absorb, and hold a strong landing.'),
    ('Countermovement Jump', 'Power', 'Bodyweight', 'Jump', 'completion', 'Explode vertically and land with control.'),
    ('Lateral Bound', 'Power', 'Bodyweight', 'Lateral power', 'completion', 'Push the ground away and own the landing.'),

    ('Sprint Start', 'Speed', 'Open space', 'Acceleration', 'time', 'Explode from a strong start position.'),
    ('10-Yard Sprint', 'Speed', 'Open space', 'Acceleration', 'time', 'Accelerate hard through the line.'),
    ('Flying 10', 'Speed', 'Open space', 'Max velocity', 'time', 'Build in, then sprint through a timed 10-yard zone.'),
    ('Shuttle Run', 'Conditioning', 'Cones', 'Change of direction', 'time', 'Change direction with low hips and sharp footwork.'),
    ('Pro Agility 5-10-5', 'Speed', 'Cones', 'Change of direction', 'time', 'Explode, plant, and redirect efficiently.'),
    ('Lateral Shuffle', 'Speed', 'Open space', 'Lateral movement', 'distance', 'Stay low and move side to side without crossing feet.'),
    ('Carioca', 'Warmup', 'Open space', 'Coordination', 'distance', 'Rotate hips while keeping shoulders controlled.'),
    ('A-Skip', 'Warmup', 'Open space', 'Sprint mechanics', 'distance', 'Rhythmical skip with tall posture and active foot strike.'),
    ('High Knees', 'Warmup', 'Open space', 'Sprint mechanics', 'distance', 'Tall posture with quick contacts.'),
    ('Backpedal', 'Speed', 'Open space', 'Backward movement', 'distance', 'Stay athletic and push through the floor.'),

    ('Pallof Press', 'Core', 'Cable or band', 'Anti-rotation', 'weight_reps', 'Press straight out while resisting rotation.'),
    ('Dead Bug', 'Core', 'Bodyweight', 'Anti-extension', 'completion', 'Move opposite arm and leg while keeping low back controlled.'),
    ('Bird Dog', 'Core', 'Bodyweight', 'Stability', 'completion', 'Reach long without shifting hips.'),
    ('Front Plank', 'Core', 'Bodyweight', 'Anti-extension', 'time', 'Brace hard with glutes tight and ribs down.'),
    ('Side Plank', 'Core', 'Bodyweight', 'Lateral core', 'time', 'Hold a straight line from head to feet.'),
    ('Hollow Hold', 'Core', 'Bodyweight', 'Anti-extension', 'time', 'Keep low back controlled while reaching long.'),
    ('Farmer Carry', 'Core', 'Dumbbells or kettlebells', 'Carry', 'distance', 'Walk tall with heavy handles and quiet shoulders.'),
    ('Suitcase Carry', 'Core', 'Dumbbell or kettlebell', 'Anti-lateral flexion', 'distance', 'Carry one side without leaning.'),
    ('Bear Crawl', 'Core', 'Bodyweight', 'Crawl', 'distance', 'Move opposite hand and foot with hips low.'),

    ('World''s Greatest Stretch', 'Mobility', 'Bodyweight', 'Hip and thoracic mobility', 'completion', 'Move slowly through lunge, rotation, and hamstring positions.'),
    ('90/90 Hip Switch', 'Mobility', 'Bodyweight', 'Hip mobility', 'completion', 'Rotate hips under control without rushing.'),
    ('Couch Stretch', 'Mobility', 'Bodyweight', 'Hip flexor mobility', 'time', 'Squeeze glute and breathe into the stretch.'),
    ('Ankle Rocks', 'Mobility', 'Bodyweight', 'Ankle mobility', 'completion', 'Drive knee forward while heel stays down.'),
    ('Thoracic Open Book', 'Mobility', 'Bodyweight', 'T-spine mobility', 'completion', 'Rotate through the upper back while hips stay stacked.'),
    ('Wall Slide', 'Shoulder Health', 'Wall', 'Scapular control', 'completion', 'Slide arms overhead while keeping ribs down.'),
    ('Scap Push-Up', 'Shoulder Health', 'Bodyweight', 'Scapular control', 'completion', 'Move shoulder blades without bending elbows.'),
    ('Band External Rotation', 'Shoulder Health', 'Band', 'Rotator cuff', 'band_color', 'Rotate with elbow pinned and shoulder quiet.'),
    ('Band Internal Rotation', 'Shoulder Health', 'Band', 'Rotator cuff', 'band_color', 'Rotate inward with steady shoulder position.'),
    ('Shoulder Taps', 'Core', 'Bodyweight', 'Anti-rotation', 'completion', 'Tap shoulders without rocking hips.'),

    ('J-Band Routine', 'Arm Care', 'J-Bands', 'Arm care', 'band_color', 'Complete the assigned arm care sequence with control.'),
    ('Band No Money', 'Arm Care', 'Band', 'External rotation', 'band_color', 'Rotate both hands out while keeping elbows near the ribs.'),
    ('Prone Y', 'Arm Care', 'Bench or floor', 'Lower trap', 'weight_reps', 'Lift thumbs toward the ceiling without shrugging.'),
    ('Prone T', 'Arm Care', 'Bench or floor', 'Upper back', 'weight_reps', 'Reach wide and squeeze shoulder blades.'),
    ('Prone W', 'Arm Care', 'Bench or floor', 'Scapular control', 'weight_reps', 'Pull elbows down and back with control.'),
    ('Serratus Wall Slide', 'Arm Care', 'Wall and band', 'Serratus', 'band_color', 'Slide up while reaching through the shoulder blades.'),
    ('Wrist Pronation/Supination', 'Arm Care', 'Dumbbell', 'Forearm', 'weight_reps', 'Rotate slowly through the forearm.'),
    ('Wrist Flexion/Extension', 'Arm Care', 'Dumbbell', 'Forearm', 'weight_reps', 'Control wrist movement through full range.'),

    ('Bike Sprint', 'Conditioning', 'Bike', 'Conditioning', 'time', 'Hard effort for the assigned interval.'),
    ('Row Sprint', 'Conditioning', 'Rower', 'Conditioning', 'time', 'Drive hard with legs, then finish with arms.'),
    ('Sled Push', 'Conditioning', 'Sled', 'Push', 'distance', 'Drive through the floor with a forward body angle.'),
    ('Sled Pull', 'Conditioning', 'Sled', 'Pull', 'distance', 'Pull with strong posture and steady steps.'),
    ('Battle Ropes', 'Conditioning', 'Ropes', 'Conditioning', 'time', 'Move with intent for the assigned work interval.'),
    ('Jump Rope', 'Conditioning', 'Jump rope', 'Elasticity', 'time', 'Stay light on the feet with steady rhythm.'),
    ('Walking Recovery', 'Recovery', 'Open space', 'Recovery', 'time', 'Easy pace recovery work.'),
    ('Breathing Reset', 'Recovery', 'Bodyweight', 'Recovery', 'time', 'Slow nasal breathing to downshift after training.')
)
insert into public.exercise_templates (
  facility_id,
  name,
  category,
  equipment,
  movement_pattern,
  input_type,
  description
)
select
  rip_city.facility_id,
  starter_exercises.name,
  starter_exercises.category,
  starter_exercises.equipment,
  starter_exercises.movement_pattern,
  starter_exercises.input_type,
  starter_exercises.description
from rip_city
cross join starter_exercises
on conflict do nothing;
