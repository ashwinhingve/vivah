const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const c = mongoose.connection.db.collection('profiles_content');
    
    const result = await c.updateMany(
      { userId: { $in: ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'] } },
      { 
        $set: { 
          'partnerPreferences.openToInterCaste': true,
          'partnerPreferences.incomeRange': '0-100 LPA',  // very wide range
        } 
      }
    );
    
    console.log('Updated', result.modifiedCount, 'documents');
    
    const docs = await c.find({ userId: { $in: ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'] } }).toArray();
    docs.forEach(d => {
      console.log('---', d.userId, '---');
      console.log('  openToInterCaste:', d.partnerPreferences && d.partnerPreferences.openToInterCaste);
      console.log('  incomeRange:', d.partnerPreferences && d.partnerPreferences.incomeRange);
    });
    
    await mongoose.disconnect();
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
