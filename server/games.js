const crypto = require('crypto');
const { createBoard } = require('./board');
const { rollDice } = require('./dice');

const MAX_PLAYERS = 6;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const RESERVE_FROM_ROLL = 4; // 1-indexed roll number from which reservation kicks in

const games = new Map(); // code -> game

function genCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  } while (games.has(code));
  return code;
}

function genId() {
  return crypto.randomUUID();
}

function createGame(adminName) {
  const code = genCode();
  const adminId = genId();
  const player = {
    id: adminId,
    token: genId(),
    name: adminName,
    isAdmin: true,
    connected: true,
    board: createBoard()
  };
  const game = {
    code,
    players: [player],
    status: 'lobby', // lobby | active | ended
    turnOrder: [],
    rollNumber: 0,
    currentRollerIndex: 0,
    dice: null,
    rolledThisTurn: false,
    reservedDice: [], // die ids reserved this turn (roll >= RESERVE_FROM_ROLL)
    createdAt: Date.now()
  };
  games.set(code, game);
  return { game, player };
}

function getGame(code) {
  return games.get(String(code || '').toUpperCase());
}

function joinGame(code, name, token) {
  const game = getGame(code);
  if (!game) return { error: 'Game not found.' };

  if (token) {
    const existing = game.players.find((p) => p.token === token);
    if (existing) {
      existing.connected = true;
      if (name && name.trim()) existing.name = name.trim().slice(0, 24);
      return { game, player: existing };
    }
  }

  if (game.status !== 'lobby') {
    return { error: 'This game has already started. Ask the admin for a new game.' };
  }
  if (game.players.length >= MAX_PLAYERS) {
    return { error: 'This game already has 6 players.' };
  }
  if (!name || !name.trim()) {
    return { error: 'Please enter a name.' };
  }

  const player = {
    id: genId(),
    token: genId(),
    name: name.trim().slice(0, 24),
    isAdmin: false,
    connected: true,
    board: createBoard()
  };
  game.players.push(player);
  return { game, player };
}

function requireAdmin(game, playerId) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player || !player.isAdmin) throw new Error('Admin only.');
  return player;
}

function currentRoller(game) {
  if (!game.turnOrder.length) return null;
  const id = game.turnOrder[game.currentRollerIndex % game.turnOrder.length];
  return game.players.find((p) => p.id === id) || null;
}

function startGame(game, playerId) {
  requireAdmin(game, playerId);
  if (game.status !== 'lobby') throw new Error('Game already started.');
  if (game.players.length < 1) throw new Error('Need at least one player.');
  game.turnOrder = game.players.map((p) => p.id);
  game.status = 'active';
  game.rollNumber = 0;
  game.currentRollerIndex = 0;
  game.dice = null;
  game.rolledThisTurn = false;
  game.reservedDice = [];
}

function stopGame(game, playerId) {
  requireAdmin(game, playerId);
  if (game.status !== 'active') throw new Error('Game is not active.');
  game.status = 'ended';
}

function skipTurn(game, playerId) {
  requireAdmin(game, playerId);
  if (game.status !== 'active') throw new Error('Game is not active.');
  advanceTurn(game);
}

function roll(game, playerId) {
  if (game.status !== 'active') throw new Error('Game is not active.');
  const roller = currentRoller(game);
  if (!roller || roller.id !== playerId) throw new Error('Not your turn to roll.');
  if (game.rolledThisTurn) throw new Error('Already rolled this turn.');
  game.dice = rollDice();
  game.rolledThisTurn = true;
  game.reservedDice = [];
  game.rollNumber += 1;
}

function reserveDice(game, playerId, dieIds) {
  if (game.status !== 'active') throw new Error('Game is not active.');
  const roller = currentRoller(game);
  if (!roller || roller.id !== playerId) throw new Error('Not your turn.');
  if (!game.rolledThisTurn || !game.dice) throw new Error('Roll first.');
  if (game.rollNumber < RESERVE_FROM_ROLL) throw new Error('No reservation on this roll.');
  if (game.reservedDice.length) throw new Error('Already set aside.');
  if (!Array.isArray(dieIds) || dieIds.length !== 2) throw new Error('Pick exactly two dice.');

  const dice = dieIds.map((id) => game.dice.find((d) => d.id === id));
  if (dice.some((d) => !d)) throw new Error('Unknown die.');
  const kinds = dice.map((d) => d.kind).sort();
  if (kinds[0] !== 'color' || kinds[1] !== 'number') {
    throw new Error('Must set aside one number die and one colour die.');
  }
  game.reservedDice = dieIds.slice();
}

function nextRoll(game, playerId) {
  if (game.status !== 'active') throw new Error('Game is not active.');
  const roller = currentRoller(game);
  if (!roller || roller.id !== playerId) throw new Error('Not your turn.');
  if (!game.rolledThisTurn) throw new Error('Roll first.');
  if (game.rollNumber >= RESERVE_FROM_ROLL && game.reservedDice.length !== 2) {
    throw new Error('Set aside your two dice first.');
  }
  advanceTurn(game);
}

function advanceTurn(game) {
  game.currentRollerIndex = (game.currentRollerIndex + 1) % game.turnOrder.length;
  game.dice = null;
  game.rolledThisTurn = false;
  game.reservedDice = [];
}

function updateBoard(game, playerId, action) {
  if (game.status === 'ended') throw new Error('Game has ended.');
  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found.');
  const { applyBoardUpdate } = require('./board');
  applyBoardUpdate(player.board, action);
}

function markDisconnected(playerId) {
  for (const game of games.values()) {
    const player = game.players.find((p) => p.id === playerId);
    if (player) player.connected = false;
  }
}

function publicState(game) {
  const roller = currentRoller(game);
  return {
    code: game.code,
    status: game.status,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      isAdmin: p.isAdmin,
      connected: p.connected,
      board: p.board
    })),
    turnOrder: game.turnOrder,
    rollNumber: game.rollNumber,
    currentRollerId: roller ? roller.id : null,
    dice: game.dice,
    rolledThisTurn: game.rolledThisTurn,
    reservedDice: game.reservedDice,
    reserveFromRoll: RESERVE_FROM_ROLL,
    maxPlayers: MAX_PLAYERS
  };
}

module.exports = {
  MAX_PLAYERS,
  createGame,
  getGame,
  joinGame,
  startGame,
  stopGame,
  skipTurn,
  roll,
  reserveDice,
  nextRoll,
  updateBoard,
  markDisconnected,
  publicState
};
