const mongoose = require('mongoose');

const uri = process.env.RESTORE_MONGO_URI;
if (!uri) {
  console.error('RESTORE_MONGO_URI is required');
  process.exit(1);
}

const requiredCollections = ['users', 'messages'];

(async () => {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    const names = collections.map(collection => collection.name);
    const missing = requiredCollections.filter(name => !names.includes(name));
    if (missing.length > 0) {
      throw new Error(`Restored database is missing required collections: ${missing.join(', ')}`);
    }

    const counts = {};
    for (const name of requiredCollections) {
      counts[name] = await mongoose.connection.db.collection(name).countDocuments();
    }

    if (counts.users < 1 || counts.messages < 1) {
      throw new Error('Restored database contains no application data in users or messages');
    }

    console.log(`Restore verified: ${names.length} collections present; users=${counts.users}; messages=${counts.messages}`);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
})().catch(error => {
  console.error(`Restore verification failed: ${error.message}`);
  process.exit(1);
});
