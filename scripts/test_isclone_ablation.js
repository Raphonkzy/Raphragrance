const fs = require('fs');
const readline = require('readline');
const { DatabaseSync } = require('node:sqlite');
const {
  db,
  splitData,
  loadGroundTruth,
  normalizeNoteDict,
  cloneHouses
} = require('./ablation_common');

// Let's compare Validation metrics WITH isClone vs WITHOUT isClone
// using our fast MinHeap runner

// Let's create run_eval_isclone.js
