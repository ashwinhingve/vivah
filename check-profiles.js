const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const c = mongoose.connection.db.collection('profilecontents');
    
    const totalCount = await c.countDocuments();
    console.log('Total profilecontents documents:', totalCount);
    
    const sample = await c.find().limit(3).toArray();
    console.log('Sample userIds in MongoDB:');
    sample.forEach(d => console.log('  -', d.userId, '| gender:', d.personal?.gender, '| city:', d.location?.city));
    
    await mongoose.disconnect();
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
