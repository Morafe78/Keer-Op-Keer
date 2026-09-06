const crypto = require('crypto');

// Three number dice: 1,2,3,4,5,? (wild). Three colour dice: orange, pink,
// blue, yellow, green, black.
const NUMBER_FACES = ['1', '2', '3', '4', '5', '?'];
const COLOR_FACES = ['orange', 'pink', 'blue', 'yellow', 'green', 'black'];

function randomFace(faces) {
  return faces[crypto.randomInt(faces.length)];
}

function rollDice() {
  const dice = [];
  for (let i = 0; i < 3; i++) {
    dice.push({ id: `n${i}`, kind: 'number', value: randomFace(NUMBER_FACES) });
  }
  for (let i = 0; i < 3; i++) {
    dice.push({ id: `c${i}`, kind: 'color', value: randomFace(COLOR_FACES) });
  }
  return dice;
}

module.exports = { rollDice, NUMBER_FACES, COLOR_FACES };
