const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const c = mongoose.connection.db.collection('profiles_content');
    
    const totalCount = await c.countDocuments();
    console.log('Total profiles_content documents:', totalCount);
    console.log('');
    
    const userIds = ['JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', 'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets'];
    for (const uid of userIds) {
      const doc = await c.findOne({ userId: uid });
      console.log('=== ' + uid + ' ===');
      if (!doc) { console.log('  NOT FOUND'); console.log(''); continue; }
      console.log('  gender:        ', doc.personal && doc.personal.gender);
      console.log('  dob:           ', doc.personal && doc.personal.dob);
      console.log('  religion:      ', doc.personal && doc.personal.religion);
      console.log('  pref ageRange: ', doc.partnerPreferences && JSON.stringify(doc.partnerPreferences.ageRange));
      console.log('  pref religion: ', doc.partnerPreferences && JSON.stringify(doc.partnerPreferences.religion));
      console.log('  pref openInterfaith:', doc.partnerPreferences && doc.partnerPreferences.openToInterfaith);
      console.log('  pref maxDist:  ', doc.partnerPreferences && doc.partnerPreferences.maxDistanceKm);
      console.log('  city:          ', doc.location && doc.location.city);
      console.log('  state:         ', doc.location && doc.location.state);
      console.log('');
    }
    
    await mongoose.disconnect();
  })
  .catch(err => { console.error('Error:', err.message); process.exit(1); });
