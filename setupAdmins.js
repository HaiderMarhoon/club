require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/user');

const adminAccounts = [
  { username: 'Haider', password: '123456' },
  { username: 'nasr', password: '123' },
  { username: 'hashem', password: '123' },
  { username: 'younis', password: '123' },
];

async function setupAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    for (const admin of adminAccounts) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      
      await User.findOneAndUpdate(
        { username: admin.username },
        { 
          username: admin.username,
          password: hashedPassword,
          isAdmin: true 
        },
        { upsert: true, new: true }
      );
      
      console.log(`Admin account ${admin.username} created/updated`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up admins:', error);
    process.exit(1);
  }
}

setupAdmins();