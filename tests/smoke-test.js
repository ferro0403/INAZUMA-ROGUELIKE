'use strict';
const assert = require('assert');
const fs = require('fs');
for (const file of ['index.html','css/game.css','js/app.js','js/season1-config.js']) assert.ok(fs.statSync(file).size > 0, `${file} must exist`);
const config = fs.readFileSync('js/season1-config.js','utf8');
for (const type of ['five_v_five','item','trade','pull_free_agents','pull_unlocked_teams','pull_legendary','random','boss']) assert.match(config, new RegExp(`\\b${type}:\\s*\\{[^}]*color:`), `${type} keeps a color`);
console.log('smoke-test: ok');
