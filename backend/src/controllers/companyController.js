const db = require('../database/models');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Helper to filter by company (handle null for superadmin)
const getCompanyId = (req) => req.companyId || null;

exports.getCompanies = async (req, res) => {
    try {
        const companies = await db.Company.findAll({
            include: [{ 
                model: db.User, 
                limit: 1, // Just get one user as reference? or get count?
                attributes: ['email'] 
            }]
        });
        res.json(companies);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCompany = async (req, res) => {
    try {
        const { companyName, taxId, adminEmail, adminPassword, maxSlots, phone, address, city, website, industry, timezone } = req.body;

        if (!companyName || !adminEmail || !adminPassword) {
            return res.status(400).json({ message: "Faltan datos requeridos (Empresa, Email, Contraseña)." });
        }

        // Check if email exists globaly
        const existingUser = await db.User.findOne({ where: { email: adminEmail } });
        if (existingUser) return res.status(400).json({ message: "El email ya está registrado." });

        // 1. Create Company
        const slug = companyName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const company = await db.Company.create({
            name: companyName,
            tax_id: taxId,
            slug: slug,
            is_active: true,
            max_slots: maxSlots ? parseInt(maxSlots) : 1,
            phone, address, city, website, industry, timezone
        });

        // 2. Create Admin User for this Company
        const hashedPassword = bcrypt.hashSync(adminPassword, 8);
        const adminUser = await db.User.create({
            username: adminEmail.split('@')[0], // Default username
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            company_id: company.id
        });

        res.json({ message: "Empresa creada exitosamente.", company, admin: adminUser });

    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await db.Company.findByPk(id);
        if (!company) return res.status(404).json({ message: "Empresa no encontrada" });

        company.is_active = !company.is_active;
        await company.save();

        res.json({ message: `Empresa ${company.is_active ? 'activada' : 'desactivada'}`, company });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { days, date } = req.body; // Add N days OR set specific date
        
        const company = await db.Company.findByPk(id);
        if (!company) return res.status(404).json({ message: "Empresa no encontrada" });

        let newDate = new Date();
        
        // If extension by days requested
        if (days) {
            const currentEnd = (company.subscription_end && company.subscription_end > new Date()) 
                ? new Date(company.subscription_end) 
                : new Date();
            currentEnd.setDate(currentEnd.getDate() + parseInt(days));
            newDate = currentEnd;
        } 
        // If specific date requested
        else if (date) {
            newDate = new Date(date);
        }

        company.subscription_end = newDate;
        company.plan_status = 'active';
        company.is_active = true; // Auto-activate if renweing
        await company.save();

        res.json({ message: "Suscripción actualizada.", company });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateBranding = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'logo', 'icon', 'favicon'
        
        console.log(`[Branding Upload] Target ID: ${id}, Type: ${type}`);

        if (!type) {
            console.error(`[Branding Error] Missing 'type' in request body`);
            return res.status(400).json({ message: "Tipo de branding no especificado (logo, icon, favicon)." });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No se subió ningún archivo." });
        }

        const file = req.files[0];
        const uploadsDir = path.join(__dirname, '../../', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const fullPath = path.join(uploadsDir, file.filename);

        // Sharp Optimization
        try {
            const tempPath = fullPath + '_branding_tmp';
            await sharp(fullPath)
                .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
                .png({ quality: 90 })
                .toFile(tempPath);
            
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            fs.renameSync(tempPath, fullPath);
            console.log(`[Branding Optimization] Processed ${file.filename}`);
        } catch (optimizeErr) {
            console.error(`[Branding Optimization Error]`, optimizeErr.message);
        }

        const url = `uploads/${file.filename}`;

        if (id === 'global') {
            const key = `PLATFORM_${type.toUpperCase()}_URL`;
            let setting = await db.Setting.findOne({ where: { key, company_id: null } });
            if (setting) {
                setting.value = url;
                await setting.save();
            } else {
                await db.Setting.create({ key, value: url, company_id: null });
            }
            console.log(`[Branding Success] Updated Global ${type}`);
            return res.json({ message: "Branding global actualizado.", setting: { key, value: url } });
        }

        const company = await db.Company.findByPk(id);
        if (!company) return res.status(404).json({ message: "Empresa no encontrada" });

        if (type === 'logo') company.logo_url = url;
        else if (type === 'icon') company.icon_url = url;
        else if (type === 'favicon') company.favicon_url = url;
        else return res.status(400).json({ message: "Tipo de branding no válido." });
        
        await company.save();
        console.log(`[Branding Success] Updated ${type} for company ${company.name}`);
        res.json({ message: "Branding actualizado.", company });
    } catch (e) { 
        console.error(`[Branding Error]`, e);
        res.status(500).json({ error: e.message || "Error interno del servidor en branding." }); 
    }
};

exports.updateBrandingUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, url } = req.body;

        console.log(`[Branding URL] Target ID: ${id}, Type: ${type}, URL: ${url}`);

        if (!url) return res.status(400).json({ message: "Falta la URL del archivo." });

        if (id === 'global') {
            const key = `PLATFORM_${type.toUpperCase()}_URL`;
            let setting = await db.Setting.findOne({ where: { key, company_id: null } });
            if (setting) {
                setting.value = url;
                await setting.save();
            } else {
                await db.Setting.create({ key, value: url, company_id: null });
            }
            return res.json({ message: "Branding global actualizado.", setting: { key, value: url } });
        }

        const company = await db.Company.findByPk(id);
        if (!company) return res.status(404).json({ message: "Empresa no encontrada" });

        if (type === 'logo') company.logo_url = url;
        else if (type === 'icon') company.icon_url = url;
        else if (type === 'favicon') company.favicon_url = url;
        else return res.status(400).json({ message: "Tipo de branding no válido." });

        await company.save();
        res.json({ message: "Branding actualizado.", company });
    } catch (e) {
        console.error(`[Branding URL Error]`, e);
        res.status(500).json({ error: e.message });
    }
};
exports.updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, tax_id, max_slots, phone, address, city, website, industry, timezone } = req.body;

        const company = await db.Company.findByPk(id);
        if (!company) return res.status(404).json({ message: "Empresa no encontrada" });

        if (name) company.name = name;
        if (tax_id) company.tax_id = tax_id;
        if (max_slots) company.max_slots = parseInt(max_slots);
        if (phone) company.phone = phone;
        if (address) company.address = address;
        if (city) company.city = city;
        if (website) company.website = website;
        if (industry) company.industry = industry;
        if (timezone) company.timezone = timezone;

        await company.save();
        res.json({ message: "Empresa actualizada.", company });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.changeAdminPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password) return res.status(400).json({ message: "La contraseña es requerida." });

        const adminUser = await db.User.findOne({ 
            where: { company_id: id, role: 'admin' } 
        });

        if (!adminUser) return res.status(404).json({ message: "No se encontró un administrador para esta empresa." });

        adminUser.password = bcrypt.hashSync(password, 8);
        await adminUser.save();

        res.json({ message: "Contraseña actualizada exitosamente." });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
