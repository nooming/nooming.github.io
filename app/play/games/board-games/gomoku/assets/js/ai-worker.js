/* global importScripts, GomokuEngine */
'use strict';

/**
 * AI worker.
 *
 * Protocol
 *   main -> worker  { type: 'search', id, board: number[], turn, level, budget }
 *   worker -> main  { type: 'ready' }
 *                   { type: 'result', id, idx, score, depth, nodes, time }
 *                   { type: 'error', id, message }
 *
 * The search is synchronous and CPU bound, so a worker keeps the UI responsive.
 * If the worker cannot be created (e.g. file:// in some browsers) the page
 * falls back to searching on the main thread.
 */
try {
  importScripts('engine.js');
} catch (err) {
  // Nothing to report to: the main thread notices the missing "ready" event.
}

const E = typeof GomokuEngine !== 'undefined' ? GomokuEngine : null;
const engine = E ? E.createEngine() : null;

self.onmessage = function (event) {
  const msg = event.data;
  if (!msg || msg.type !== 'search') return;

  const id = msg.id;
  if (!engine) {
    self.postMessage({ type: 'error', id, message: 'engine unavailable' });
    return;
  }

  try {
    const board = msg.board;
    const turn = msg.turn === 2 ? 2 : 1;
    engine.setBoard(board, turn);
    const level = typeof msg.level === 'string' ? msg.level : 'medium';
    const budget = typeof msg.budget === 'number' ? msg.budget : 800;
    const result = engine.findBestMove(turn, level, Math.min(budget, 8000));
    self.postMessage({
      type: 'result',
      id,
      idx: result.idx,
      score: result.score,
      depth: result.depth,
      nodes: result.nodes,
      time: result.time,
      level,
    });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
  }
};

self.postMessage({ type: 'ready' });
