"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis:null, Object, Array, String, Number, Math, Set, Map, JSON };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-squad-view-base.js","utf8"), context, { filename:"rtg-squad-view-base.js" });

const view = context.RoadToGlorySquadView.create({ escapeHtml:String });
const seasonOptions = [
  {value:"all",label:"Tutte"},
  {value:"ie1",label:"Season 1"},
  {value:"ie1_s2",label:"Season 2"},
  {value:"ie1_s3",label:"Season 3"},
  {value:"ie2",label:"Ares"},
];
const teamOptions = [
  {value:"all",label:"Tutte"},
  {value:"ie1::raimon",label:"Raimon"},
  {value:"ie2::polestar_academy",label:"Polestar Academy"},
];

const catalog = view.catalogMarkup({seasonOptions,teamOptions,seasonFilter:"ie2",teamFilter:"ie2::polestar_academy"});
assert(catalog.includes("data-rtg-catalog-season"), "RTG catalog must expose the season filter");
assert(catalog.includes("data-rtg-catalog-team"), "RTG catalog must expose the team filter");
assert(catalog.includes('value="ie2" selected'), "RTG catalog must preserve the selected season");
assert(catalog.includes('value="ie2::polestar_academy" selected'), "RTG catalog must preserve the selected team");

const picker = view.replacementPickerMarkup({seasonOptions,teamOptions,seasonFilter:"ie1_s2",teamFilter:"all",rarityOptions:["Elite"]});
assert(picker.includes("data-rtg-picker-season"), "Replacement picker must expose the season filter");
assert(picker.includes("data-rtg-picker-team"), "Replacement picker must expose the team filter");
assert(picker.includes('value="ie1_s2" selected'), "Replacement picker must preserve the selected season");

const controller = fs.readFileSync("js/road-to-glory/rtg-squad-controller.js","utf8");
assert(controller.includes("SQUAD_FILTER_SEASON_LABELS"), "Squad filters must define the four RTG season labels");
assert(controller.includes("squadFilterTeamOptions"), "Team options must be derived dynamically from player cards");
assert(controller.includes("cardMatchesSquadFilters"), "Season/team filters must participate in candidate filtering");
assert(/seasonFilter=String\(event\.target\?\.value\|\|"all"\);\s*refreshTeamFilterControl\(\)/s.test(controller), "Changing season must refresh and validate the team selector");
assert(controller.includes('teamFilter="all"&&!options.some') || controller.includes('teamFilter!=="all"&&!options.some'), "Invalid team selections must reset to Tutte");

const config = fs.readFileSync("js/road-to-glory/rtg-config.js","utf8");
assert(config.includes("const SEASONS=Object.freeze({ie1:SEASON1,ie1_s2:SEASON2,ie1_s3:SEASON3,ie2:ARES})"), "RTG filter season source must remain the four configured RTG seasons");

const theme = fs.readFileSync("css/rtg-theme.css","utf8");
assert(theme.includes(".rtg-picker-season-team-filters"), "Replacement season/team controls need responsive layout");
assert(theme.includes(".rtg-catalog-filter-grid"), "Catalog season/team controls need responsive layout");

console.log("rtg-bbb-season-team-filters-test: PASS");
