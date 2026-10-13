// The planner's helpers with the full catalog installed (WEB-PLAN-DATA). Every page and feature that imports this module
// reads the planner catalog synchronously, as before: importing data/planner-catalog.ts installs the full catalog into
// planner-source.ts before any helper runs. 行程 (/plan) imports `./planner-core` instead and loads the generated catalog
// after its first paint (features/plan/plan-catalog.ts); tests/plan-catalog-split.test.ts checks that no other page or
// lazy feature reaches the planner's source without this installer.
import '../data/planner-catalog';
export * from './planner-core';
