const openaiService = require('../src/services/openaiService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/database/models');

// Mock function to test transcription
async function test() {
    try {
        await db.sequelize.authenticate();
        console.log('DB Connected');
        
        // Use a dummy audio file if exists, or just check if openai client inits
        // We can't easily upload a file here without one provided.
        // But we can check if getChatCompletion works which verifies the Key.
        
        // Find a company
        const company = await db.Company.findOne();
        if(!company) { console.log('No company found'); return; }

        console.log(`Testing OpenAI for Company: ${company.name} (${company.id})`);
        
        // 1. Test Chat
        console.log('Testing Chat...');
        const response = await openaiService.getChatCompletion(company.id, [{ role: 'user', content: 'Hola' }]);
        console.log('Chat Response:', response);

        // 2. We can't test Audio easily without a file. 
        // But if Chat works, the Key is likely fine.
        // Use a dummy empty file to see if it reaches logic
        /*
        const fs = require('fs');
        const dummyPath = path.join(__dirname, 'test_audio.ogg');
        fs.writeFileSync(dummyPath, 'dummy content');
        try {
            await openaiService.transcribeAudio(dummyPath, company.id);
        } catch(e) {
            console.log('Transcription failed (expected for dummy file):', e.message);
        }
        */

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
