const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const c = mongoose.connection.db.collection('profiles_content');
    
    const result = await c.updateMany(
      { userId: { $in: ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'] } },
      { 
        $set: { 
          'partnerPreferences.ageRange': { min: 18, max: 75 },
          'partnerPreferences.religion': ['Hindu'],
          'partnerPreferences.openToInterfaith': true,
          'partnerPreferences.maxDistanceKm': 10000,
          'partnerPreferences.mustHave': {},
        } 
      }
    );
    
    console.log('Updated', result.modifiedCount, 'documents');
    
    const docs = await c.find({ userId: { $in: ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'] } }).toArray();
    docs.forEach(d => {
      console.log('---', d.userId, '---');
      console.log('  ageRange:', JSON.stringify(d.partnerPreferences && d.partnerPreferences.ageRange));
      console.log('  religion:', JSON.stringify(d.partnerPreferences && d.partnerPreferences.religion));
      console.log('  openInterfaith:', d.partnerPreferences && d.partnerPreferences.openToInterfaith);
      console.log('  maxDist:', d.partnerPreferences && d.partnerPreferences.maxDistanceKm);
      console.log('  mustHave:', JSON.stringify(d.partnerPreferences && d.partnerPreferences.mustHave));
    });
    
    await mongoose.disconnect();
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
