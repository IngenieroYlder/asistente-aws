const db = require('../database/models');
const User = db.User;
const Company = db.Company;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// Register
exports.register = async (req, res) => {
  try {
    const { username, email, password, companyName } = req.body; // Added email
    
    // Check if this is the FIRST user ever -> Make Superadmin
    const userCount = await User.count();
    const isSuperAdmin = userCount === 0;

    let companyId = null; 
    let role = isSuperAdmin ? 'superadmin' : 'agent';

    if (!isSuperAdmin) {
        if (!companyName) return res.status(400).send({ message: "Company Name is required" });
        
        const slug = companyName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const company = await Company.create({
            name: companyName,
            slug: slug
        });
        companyId = company.id;
        role = 'admin';
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    
    await User.create({
      username,
      email, // Save email
      password: hashedPassword,
      role: role,
      company_id: companyId
    });

    res.send({ message: 'User registered successfully!', role });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ 
        where: { email },
        include: [{ model: Company }] 
    });

    if (!user) return res.status(404).send({ message: 'Usuario no encontrado.' });

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).send({ accessToken: null, message: 'Contraseña inválida!' });

    // --- SESSION LIMIT CHECK (SaaS Logic) ---
    if (user.company_id) { // Only for company users
        try {
            const ActiveSession = db.ActiveSession;
            
            // 1. Cleanup expired sessions (> 24 hours)
            await ActiveSession.destroy({ 
                where: { last_active: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } 
            });

            // 2. Check current active sessions
            const sessionCount = await ActiveSession.count({ where: { company_id: user.company_id } });
            const company = await Company.findByPk(user.company_id);
            
            if (!company) {
                console.warn(`[Login] Company ${user.company_id} not found for user ${user.email}`);
            } else {
                const maxSlots = company.max_slots || 1;
                if (sessionCount >= maxSlots) {
                    const existingUserSession = await ActiveSession.findOne({ where: { user_id: user.id } });
                    if (!existingUserSession) {
                        return res.status(403).send({ 
                            message: `Límite de conexiones simultáneas alcanzado (${sessionCount}/${maxSlots}).` 
                        });
                    }
                }

                // 3. Register new session
                const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
                await ActiveSession.destroy({ where: { user_id: user.id } });
                await ActiveSession.create({
                    company_id: user.company_id,
                    user_id: user.id,
                    device_info: deviceInfo,
                    token: 'valid'
                });
            }
        } catch (sessionErr) {
            console.error(`[Login Session Error]`, sessionErr);
            // We allow login to proceed even if session tracking fails, to avoid locking users out
        }
    }
    // ----------------------------------------

    // Get configurable session duration
    let sessionDurationHours = 8;
    try {
      const Setting = db.Setting;
      const durationSetting = await Setting.findOne({ where: { key: 'SESSION_DURATION_HOURS', company_id: null } });
      if (durationSetting && durationSetting.value) sessionDurationHours = parseInt(durationSetting.value) || 8;
    } catch (e) {}

    const expiresInSeconds = sessionDurationHours * 3600;

    const token = jwt.sign({ 
        id: user.id, 
        role: user.role,
        companyId: user.company_id 
    }, process.env.JWT_SECRET, {
      expiresIn: expiresInSeconds 
    });

    // --- GLOBAL BRANDING FOR SUPERADMIN ---
    let globalBranding = null;
    if (user.role === 'superadmin') {
        try {
            const logo = await db.Setting.findOne({ where: { key: 'PLATFORM_LOGO_URL', company_id: null } });
            const icon = await db.Setting.findOne({ where: { key: 'PLATFORM_ICON_URL', company_id: null } });
            const favicon = await db.Setting.findOne({ where: { key: 'PLATFORM_FAVICON_URL', company_id: null } });
            globalBranding = { 
                logo: logo ? logo.value : null, 
                icon: icon ? icon.value : null, 
                favicon: favicon ? favicon.value : null 
            };
        } catch (e) {}
    }

    res.status(200).send({
      id: user.id,
      username: user.username,
      role: user.role,
      company: user.Company,
      globalBranding, // Added this
      accessToken: token,
      expiresIn: expiresInSeconds
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.impersonate = async (req, res) => {
    try {
        // Double check superadmin (middleware usually handles this)
        if (req.userRole !== 'superadmin') return res.status(403).send({ message: 'Unauthorized' });

        const { companyId } = req.params;
        const company = await Company.findByPk(companyId);
        if (!company) return res.status(404).send({ message: 'Company not found' });

        // Find an admin for this company
        const adminUser = await User.findOne({ 
            where: { company_id: companyId, role: 'admin' } 
        });

        if (!adminUser) return res.status(404).send({ message: 'No admin user found for this company' });

        // Generate token for the target admin
        const token = jwt.sign({ 
            id: adminUser.id, 
            role: adminUser.role,
            companyId: adminUser.company_id 
        }, process.env.JWT_SECRET, {
            expiresIn: 3600 // 1 hour for impersonation
        });

        res.status(200).send({
            id: adminUser.id,
            username: adminUser.username,
            role: adminUser.role,
            company: company,
            accessToken: token,
            message: `Impersonating ${company.name}`
        });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        if (req.userId) {
            await db.ActiveSession.destroy({ where: { user_id: req.userId } });
        }
        res.status(200).send({ message: "Logged out successfully" });
    } catch (e) {
        res.status(500).send({ message: e.message });
    }
};
