import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const builder = await readFile("js/coach/workouts/builder.js", "utf8");
const library = await readFile("js/coach/workouts/exercise-library.js", "utf8");

assert.doesNotMatch(
  builder,
  /templateSearch\.addEventListener\("input"[\s\S]{0,180}applyExerciseTemplateToCard/,
  "typing an exact library name must not automatically apply a template"
);
assert.match(
  builder,
  /data-exercise-template-choice[\s\S]*applyExerciseTemplateToCard/,
  "a coach explicitly selects a suggestion before its template is applied"
);
assert.doesNotMatch(
  builder,
  /<datalist|\slist=/,
  "native datalist autocomplete cannot replace a partially typed exercise name"
);
assert.match(
  library,
  /normalizeExerciseName\(template\.name\)\.includes\(search\)/,
  "suggestions still filter the exercise library while the coach types"
);
assert.match(
  builder,
  /event\.key !== "Escape"[\s\S]*exercise-template-suggestions[\s\S]*classList\.add\("hidden"\)/,
  "the explicit suggestion menu can be dismissed without selecting an exercise"
);

console.log("Workout exercise picker checks passed.");
