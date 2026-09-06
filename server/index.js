const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const { LAYOUT } = require('./boardLayout');
const games = require('./games');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/api/layout', (req, res) => res.json(LAYOUT));

function broadcast(game) {
  io.to(game.code).emit('state', games.publicState(game));
}

io.on('connection', (socket) => {
  socket.data.code = null;
  socket.data.playerId = null;

  socket.on('create', ({ name } = {}, ack) => {
    try {
      if (!name || !name.trim()) throw new Error('Please enter a name.');
      const { game, player } = games.createGame(name.trim().slice(0, 24));
      socket.join(game.code);
      socket.data.code = game.code;
      socket.data.playerId = player.id;
      ack?.({ ok: true, code: game.code, playerId: player.id, token: player.token });
      broadcast(game);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('join', ({ code, name, token } = {}, ack) => {
    const { game, player, error } = games.joinGame(code, name, token);
    if (error) {
      ack?.({ ok: false, error });
      return;
    }
    socket.join(game.code);
    socket.data.code = game.code;
    socket.data.playerId = player.id;
    ack?.({ ok: true, code: game.code, playerId: player.id, token: player.token });
    broadcast(game);
  });

  function withGame(handler) {
    return (payload, ack) => {
      try {
        const game = games.getGame(socket.data.code);
        if (!game) throw new Error('Game not found.');
        handler(game, payload || {});
        ack?.({ ok: true });
        broadcast(game);
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    };
  }

  socket.on('start', withGame((game) => games.startGame(game, socket.data.playerId)));
  socket.on('stop', withGame((game) => games.stopGame(game, socket.data.playerId)));
  socket.on('skipTurn', withGame((game) => games.skipTurn(game, socket.data.playerId)));
  socket.on('roll', withGame((game) => games.roll(game, socket.data.playerId)));
  socket.on('reserveDice', withGame((game, { dieIds }) => games.reserveDice(game, socket.data.playerId, dieIds)));
  socket.on('nextRoll', withGame((game) => games.nextRoll(game, socket.data.playerId)));
  socket.on('markDone', withGame((game) => games.markDone(game, socket.data.playerId)));
  socket.on('updateBoard', withGame((game, action) => games.updateBoard(game, socket.data.playerId, action)));

  socket.on('disconnect', () => {
    if (socket.data.playerId) {
      games.markDisconnected(socket.data.playerId);
      const game = games.getGame(socket.data.code);
      if (game) broadcast(game);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Keer op Keer server listening on http://localhost:${PORT}`);
});
