import { WebSocket } from 'ws';

// Create connection to WebSocket server
console.log('Attempting to connect to WebSocket server...');

const socket = new WebSocket('ws://localhost:5000/ws');

// Connection opened
socket.on('open', () => {
  console.log('Connection established successfully');
  
  // Send a test message
  const message = {
    type: 'test',
    data: 'Hello from WebSocket test client',
    timestamp: new Date().toISOString()
  };
  
  console.log('Sending message:', message);
  socket.send(JSON.stringify(message));
  
  // Set up regular ping to keep connection alive
  const interval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const pingMessage = {
        type: 'ping',
        timestamp: new Date().toISOString()
      };
      socket.send(JSON.stringify(pingMessage));
      console.log('Ping sent at', new Date().toLocaleTimeString());
    } else {
      clearInterval(interval);
    }
  }, 10000);
  
  // Schedule closing the connection after a minute
  setTimeout(() => {
    console.log('Test completed, closing connection');
    clearInterval(interval);
    socket.close();
    process.exit(0);
  }, 60000);
});

// Listen for messages
socket.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('Received message:', message);
  } catch (error) {
    console.log('Received message (not JSON):', data.toString());
  }
});

// Error handling
socket.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

// Connection closed
socket.on('close', (code, reason) => {
  console.log(`Connection closed: Code=${code}, Reason=${reason || 'None provided'}`);
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Process interrupted, closing connection');
  if (socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
  process.exit(0);
});