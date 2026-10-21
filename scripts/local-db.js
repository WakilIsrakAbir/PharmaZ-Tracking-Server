// A local MongoDB for development, with nothing to install.
// MongoDB is downloaded once; your data stays in server/.data/db between runs.
// It only starts when MONGODB_URI points at this computer.
import net from 'node:net';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const local = (process.env.MONGODB_URI ?? '').match(/^mongodb:\/\/(?:127\.0\.0\.1|localhost):(\d+)/);

if (!local) {
  console.log('MONGODB_URI points to another server, so the local database is not needed.');
  process.exit(0);
}

const port = Number(local[1]);
if (await isPortInUse(port)) {
  console.log(`✓ A MongoDB is already running on port ${port}. Using that one.`);
  process.exit(0);
}

const dbPath = fileURLToPath(new URL('../.data/db', import.meta.url));
mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { ip: '127.0.0.1', port, dbPath, storageEngine: 'wiredTiger' },
});
console.log(`✓ Local MongoDB running on 127.0.0.1:${port} (data in server/.data/db)`);

async function stop() {
  await mongod.stop({ doCleanup: false }); // keep the data folder
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

function isPortInUse(portNumber) {
  return new Promise((resolve) => {
    const socket = net.connect(portNumber, '127.0.0.1');
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}
