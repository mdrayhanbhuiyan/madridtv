// Namecheap Shared Hosting / cPanel Node.js Startup File
// This script serves as the wrapper entrypoint for Phusion Passenger.
// Before starting your node.js app, make sure to build the production build using "npm run build".

process.env.NODE_ENV = 'production';

// Import the bundled and compiled server code (dist/server.cjs)
require('./dist/server.cjs');
