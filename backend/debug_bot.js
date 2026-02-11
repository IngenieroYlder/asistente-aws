const { Company, Setting, Session, Message } = require('./src/database/models');

async function check() {
    try {
        const companies = await Company.findAll({ raw: true });
        console.log('COMPANIES:', companies.map(c => ({ id: c.id, name: c.name })));

        const selvatico = companies.find(c => c.name.toLowerCase().includes('selvático')) || companies[0];
        if (!selvatico) return console.log('No companies found');

        console.log('--- SETTINGS FOR:', selvatico.name, '---');
        const settings = await Setting.findAll({ where: { company_id: selvatico.id }, raw: true });
        settings.forEach(s => console.log(`${s.key}: ${s.value}`));

        console.log('--- LATEST MESSAGES ---');
        const latestMsgs = await Message.findAll({ 
            where: { company_id: selvatico.id },
            order: [['createdAt', 'DESC']],
            limit: 10,
            raw: true
        });
        latestMsgs.reverse().forEach(m => console.log(`[${m.role}]: ${m.content}`));

    } catch (e) { console.error(e); }
    process.exit();
}
check();
