const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Ensure Env is loaded

const seed = async () => {
    const db = require('../src/database/models');
    const bcrypt = require('bcryptjs');

    try {
        await db.sequelize.authenticate();
        console.log('✅ Connected to DB');
        
        // Sync to ensure email column exists
        await db.sequelize.sync({ alter: true });

        const username = "Ingeniero Ylder";
        const email = "ingenieroylder@gmail.com";
        const password = "***Princesa90***";

        const hashedPassword = bcrypt.hashSync(password, 8);

        // Check by email first, then username
        let existing = await db.User.findOne({ where: { email } });
        if (!existing) {
             existing = await db.User.findOne({ where: { username: "Ingenerio Ylder" } }); // Logic to catch the old typo one if it exists without email
        }

        if (existing) {
            existing.username = username; // Update name
            existing.email = email; // Ensure email is set
            existing.password = hashedPassword;
            existing.role = 'superadmin';
            existing.company_id = null;
            await existing.save();
            console.log(`✅ User updated: ${username} (${email})`);
        } else {
            await db.User.create({
                username: username,
                email: email,
                password: hashedPassword,
                role: 'superadmin',
                company_id: null
            });
            console.log(`✅ User created: ${username} (${email})`);
        }

    } catch (e) {
        console.error("❌ Error seeding:", e);
    } finally {
        process.exit();
    }
};

seed();
