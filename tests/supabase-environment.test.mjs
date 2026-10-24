import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const clientSource = fs.readFileSync(
  new URL("../js/shared/supabaseClient.js", import.meta.url),
  "utf8",
);

function loadClient(hostname) {
  let createdWith = null;
  const window = {
    location: { hostname },
    supabase: {
      createClient(url, publishableKey) {
        createdWith = { url, publishableKey };
        return { url };
      },
    },
  };

  vm.runInNewContext(clientSource, { window });
  return { window, createdWith };
}

const production = loadClient("rip-city-training.netlify.app");
assert.equal(production.window.RIP_CITY_ENVIRONMENT, "production");
assert.equal(
  production.createdWith.url,
  "https://fdzmfohcuratbuitkwoy.supabase.co",
);

for (const hostname of [
  "ripcitystaging.netlify.app",
  "deploy-preview-17--ripcitystaging.netlify.app",
  "deploy-preview-18--rip-city-training.netlify.app",
  "localhost",
  "127.0.0.1",
  "",
]) {
  const staging = loadClient(hostname);
  assert.equal(
    staging.window.RIP_CITY_ENVIRONMENT,
    "staging",
    `${hostname || "empty hostname"} must use staging`,
  );
  assert.equal(
    staging.createdWith.url,
    "https://xjgmjliqqkhfnqphigbk.supabase.co",
  );
}

console.log("Supabase environment routing checks passed.");
