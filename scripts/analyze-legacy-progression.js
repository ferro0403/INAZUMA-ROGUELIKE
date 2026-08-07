#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const STAT_ORDER = ["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"];
const GOLDEN_FILES = ["data/IE1_season_compact.json", "data/FREE_AGENTS_compact.json"];
const SPLIT_SEED = 0x1e1f4a;
const TRAIN_FRACTION = 0.8;

function features(finalOverall, finalStat) {
  const stat = finalStat / 100;
  const overall = (finalOverall - 80) / 10;
  return [1, stat, overall, stat * overall, overall * overall];
}

function solve(matrix, vector) {
  const size = vector.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    [vector[column], vector[pivot]] = [vector[pivot], vector[column]];
    const divisor = matrix[column][column];
    for (let index = column; index < size; index += 1) matrix[column][index] /= divisor;
    vector[column] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let index = column; index < size; index += 1) matrix[row][index] -= factor * matrix[column][index];
      vector[row] -= factor * vector[column];
    }
  }
  return vector;
}

function loadPlayers(root) {
  return GOLDEN_FILES.flatMap((relativePath) => {
    const database = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
    return database.players
      .filter((player) => typeof player.progressionCode === "string")
      .map((player) => ({ player, database, source: relativePath }));
  });
}

function shuffledPlayerIndexes(length) {
  const indexes = Array.from({ length }, (_, index) => index);
  let state = SPLIT_SEED;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes;
}

function decode(player, database, statIndex, level) {
  const { codeWidth, levelMax } = database.compactFormat;
  const offset = (statIndex * (levelMax + 1) + level) * codeWidth;
  return parseInt(player.progressionCode.slice(offset, offset + codeWidth), 36);
}

function calibrate(players, trainIndexes) {
  const size = 5;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const vector = Array(size).fill(0);
  players.forEach(({ player, database }, playerIndex) => {
    if (!trainIndexes.has(playerIndex)) return;
    STAT_ORDER.forEach((stat, statIndex) => {
      const input = features(player.finalOverall, player.finalStats[stat]);
      const level0 = decode(player, database, statIndex, 0);
      for (let row = 0; row < size; row += 1) {
        vector[row] += input[row] * level0;
        for (let column = 0; column < size; column += 1) matrix[row][column] += input[row] * input[column];
      }
    });
  });
  return solve(matrix, vector);
}

function metricSet(players, selectedIndexes, coefficients) {
  const totals = { values: 0, oldError: 0, newError: 0, oldMismatch: 0, newMismatch: 0, oldMax: 0, newMax: 0, level0Values: 0, oldLevel0Error: 0, newLevel0Error: 0, newLevel0Max: 0 };
  players.forEach(({ player, database }, playerIndex) => {
    if (selectedIndexes && !selectedIndexes.has(playerIndex)) return;
    STAT_ORDER.forEach((stat, statIndex) => {
      const finalStat = player.finalStats[stat];
      const estimatedLevel0 = Math.round(features(player.finalOverall, finalStat).reduce((sum, value, index) => sum + value * coefficients[index], 0));
      for (let level = 0; level <= database.compactFormat.levelMax; level += 1) {
        const actual = decode(player, database, statIndex, level);
        const oldValue = Math.round(finalStat * (0.6 + (0.4 * level / 20)));
        const newValue = level === 20 ? finalStat : Math.round(estimatedLevel0 + ((finalStat - estimatedLevel0) * level / 20));
        const oldError = Math.abs(oldValue - actual);
        const newError = Math.abs(newValue - actual);
        totals.values += 1;
        totals.oldError += oldError;
        totals.newError += newError;
        totals.oldMismatch += Number(oldError > 0);
        totals.newMismatch += Number(newError > 0);
        totals.oldMax = Math.max(totals.oldMax, oldError);
        totals.newMax = Math.max(totals.newMax, newError);
        if (level === 0) {
          totals.level0Values += 1;
          totals.oldLevel0Error += oldError;
          totals.newLevel0Error += newError;
          totals.newLevel0Max = Math.max(totals.newLevel0Max, newError);
        }
      }
    });
  });
  return {
    values: totals.values,
    oldMAE: totals.oldError / totals.values,
    newMAE: totals.newError / totals.values,
    oldMaxError: totals.oldMax,
    newMaxError: totals.newMax,
    oldMismatchPercent: totals.oldMismatch * 100 / totals.values,
    newMismatchPercent: totals.newMismatch * 100 / totals.values,
    oldLevel0MAE: totals.oldLevel0Error / totals.level0Values,
    newLevel0MAE: totals.newLevel0Error / totals.level0Values,
    newLevel0MaxError: totals.newLevel0Max,
  };
}

function analyzeLegacyProgression(root = path.resolve(__dirname, "..")) {
  const players = loadPlayers(root);
  const shuffled = shuffledPlayerIndexes(players.length);
  const trainSize = Math.floor(players.length * TRAIN_FRACTION);
  const trainIndexes = new Set(shuffled.slice(0, trainSize));
  const holdoutIndexes = new Set(shuffled.slice(trainSize));
  const coefficients = calibrate(players, trainIndexes);
  return {
    seed: SPLIT_SEED,
    players: players.length,
    trainPlayers: trainIndexes.size,
    holdoutPlayers: holdoutIndexes.size,
    coefficients,
    train: metricSet(players, trainIndexes, coefficients),
    holdout: metricSet(players, holdoutIndexes, coefficients),
    full: metricSet(players, null, coefficients),
  };
}

if (require.main === module) console.log(JSON.stringify(analyzeLegacyProgression(), null, 2));

module.exports = { analyzeLegacyProgression, STAT_ORDER, GOLDEN_FILES };
