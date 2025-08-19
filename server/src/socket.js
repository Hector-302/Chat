const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const users = new Map();

io.on('connection', (socket) => {
  console.log('Connected', socket.id);

  socket.on('register', (userId) => {
    users.set(userId, socket.id);
    console.log(`Registered user ${userId} with socket ${socket.id}`);
  });

  socket.on('private_message', ({ to, message }) => {
    const destSocketId = users.get(to);
    console.log(`Private message from ${socket.id} to user ${to}`);
    if (destSocketId) {
      io.to(destSocketId).emit('private_message', { from: socket.id, message });
      console.log(`Forwarded message to socket ${destSocketId}`);
    } else {
      console.log(`User ${to} not found`);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, sockId] of users.entries()) {
      if (sockId === socket.id) {
        users.delete(userId);
        break;
      }
    }
    console.log('Disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Socket server running on port ${PORT}`));
