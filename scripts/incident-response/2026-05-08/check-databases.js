const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    console.log('Available databases:');
    dbs.databases.forEach(db => console.log('  -', db.name, '(', Math.round(db.sizeOnDisk / 1024), 'KB )'));
    
    console.log('');
    console.log('Currently connected DB name:', mongoose.connection.db.databaseName);
    console.log('');
    
    // Check ALL collections in current DB
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in', mongoose.connection.db.databaseName + ':');
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log('  -', col.name, ':', count, 'docs');
    }
    
    await mongoose.disconnect();
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
