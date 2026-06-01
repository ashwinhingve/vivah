const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const c = mongoose.connection.db.collection('profiles_content');
    
    // Update both profiles to have wider age range that includes each other
    const result = await c.updateMany(
      { userId: { $in: ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'] } },
      { $set: { 'partnerPreferences.ageRange': { min: 18, max: 35 } } }
    );
    
    console.log('Updated', result.modifiedCount, 'documents');
    
    // Verify
    const docs = await c.find({ userId: { $in: ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'] } }).toArray();
    docs.forEach(d => {
      console.log(d.userId, '→ ageRange:', JSON.stringify(d.partnerPreferences.ageRange));
    });
    
    await mongoose.disconnect();
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
