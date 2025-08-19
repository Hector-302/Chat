import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function Chat() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const handler = ({ from, message }) => {
      setMessages((prev) => [...prev, { from, message }]);
    };

    socket.on('private_message', handler);

    return () => {
      socket.off('private_message', handler);
    };
  }, []);

  return (
    <div>
      {messages.map((m, idx) => (
        <div key={idx}>
          <strong>{m.from}:</strong> {m.message}
        </div>
      ))}
    </div>
  );
}
