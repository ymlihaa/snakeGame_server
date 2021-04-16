const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});
const port = 3001;

// --
const { initGame, gameLoop, getUpdatedVelocity } = require("./game");
const { FRAME_RATE } = require("./constants");
const { makeid } = require("./utils");
const state = {};
const clientRooms = {};

io.on("connection", (socket) => {
  console.log("this is a new user .");

  socket.on("keydown", handleKeydown);
  socket.on("newGame", handleNewGame);
  socket.on("joinGame", handleJoinGame);

  function handleJoinGame(roomName) {
    console.log("roomName -< server : ", roomName);
    const room = io.sockets.adapter.rooms[roomName];
    console.log("handleJoin Game :", room);
    let numClients = 0;
    let allUsers;
    if (room) {
      allUsers = room.sockets;
    }

    if (allUsers) {
      numClients = Object.keys(allUsers).length;
    }

    // if (numClients === 0) {
    //   console.log(numClients);
    //   socket.emit("unknownCode");
    //   return;
    // } else if (numClients > 1) {
    //   socket.emit("tooManyPlayers");
    //   return;
    // }

    clientRooms[socket.id] = roomName;

    socket.join(roomName);
    socket.number = 2;
    socket.emit("init", 2);

    startGameInterval(roomName);
  }

  function handleNewGame() {
    let roomName = makeid(5);
    console.log(roomName);
    clientRooms[socket.id] = roomName;
    socket.emit("gameCode", roomName);
    state[roomName] = initGame();
    socket.join(roomName);
    socket.number = 1;
    socket.emit("init", 1);
  }

  function handleKeydown(keyCode) {
    const roomName = clientRooms[socket.id];
    if (!roomName) {
      return;
    }
    try {
      keyCode = parseInt(keyCode);
    } catch (e) {
      console.error(e);
      return;
    }

    const vel = getUpdatedVelocity(keyCode);

    if (vel) {
      state[roomName].players[socket.number - 1].vel = vel;
    }
  }
});

function startGameInterval(roomName) {
  const intervalId = setInterval(() => {
    const winner = gameLoop(state[roomName]);

    if (!winner) {
      emitGameState(roomName, state[roomName]);
    } else {
      emitGameOver(roomName, winner);
      state[roomName] = null;
      clearInterval(intervalId);
    }
  }, 1000 / FRAME_RATE);
}

function emitGameState(room, gameState) {
  // Send this event to everyone in the room.
  io.sockets.in(room).emit("gameState", JSON.stringify(gameState));
}

server.listen(port, () => {
  console.log("listening on *:3000");
});

function emitGameOver(room, winner) {
  io.sockets.in(room).emit("gameOver", JSON.stringify({ winner }));
}
