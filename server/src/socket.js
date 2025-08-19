const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const users = new Map();
const roomAcks = new Map();

io.on('connection', (socket) => {
  console.log('Connected', socket.id);

  socket.on('register', (userId) => {
    users.set(userId, socket.id);
    console.log(`Registered user ${userId} with socket ${socket.id}`);
  });

  socket.on('start_private_chat', ({ to, roomId }) => {
    const destSocketId = users.get(to);
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    if (destSocketId) {
      const destSocket = io.sockets.sockets.get(destSocketId);
      if (destSocket) {
        destSocket.join(roomId);
        console.log(`Socket ${destSocketId} joined room ${roomId}`);
        io.to(destSocketId).emit('joined_room', { roomId });
      }
    } else {
      console.log(`User ${to} not found`);
    }
    socket.emit('joined_room', { roomId });
    roomAcks.set(roomId, new Set());
  });

  socket.on('joined_room_ack', ({ roomId }) => {
    const set = roomAcks.get(roomId);
    if (set) {
      set.add(socket.id);
      console.log(`Socket ${socket.id} acknowledged joining room ${roomId}`);
    }
  });

  socket.on('private_message', ({ roomId, message }) => {
    const set = roomAcks.get(roomId);
    console.log(`Private message from ${socket.id} to room ${roomId}`);
    if (set && set.size === 2) {
      io.to(roomId).emit('private_message', { from: socket.id, message });
      console.log(`Forwarded message to room ${roomId}`);
    } else {
      console.log(`Room ${roomId} not ready`);
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
