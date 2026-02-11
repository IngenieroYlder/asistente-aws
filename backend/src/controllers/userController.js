const db = require('../database/models');
const bcrypt = require('bcryptjs');

// Helper to filter by company (or allow all for superadmin)
const getContext = (req) => {
    return { company_id: req.user.companyId, role: req.user.role };
};

exports.getUsers = async (req, res) => {
    try {
        const { company_id, role } = getContext(req);
        let where = {};
        
        // Superadmin fetches all users if no company filter, or filtered by company
        // Company Admin filters only their company
        if (role === 'superadmin') {
            if (req.query.companyId) where.company_id = req.query.companyId;
        } else {
            where.company_id = company_id;
        }

        const users = await db.User.findAll({ 
            where, 
            include: [{ model: db.Company }],
            attributes: { exclude: ['password'] } // Hide passwords
        });
        res.json(users);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createUser = async (req, res) => {
    try {
        const { company_id, role } = getContext(req);
        const { username, email, password, role: newRole, companyId: targetCompanyId } = req.body;

        // Security Check
        let finalCompanyId = company_id;
        if (role === 'superadmin') {
            finalCompanyId = targetCompanyId || null;
        } else {
            // Admin can only create 'agent' or 'admin' for their own company
            finalCompanyId = company_id; 
            if (newRole === 'superadmin') return res.status(403).json({ message: "No puedes crear superadmins." });
        }

        const hashedPassword = bcrypt.hashSync(password, 8);
        const user = await db.User.create({
            username,
            email,
            password: hashedPassword,
            role: newRole || 'agent',
            company_id: finalCompanyId
        });

        res.json({ message: "Usuario creado", user });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { company_id, role } = getContext(req);
        const { username, email, password, role: newRole } = req.body;

        const user = await db.User.findByPk(id);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Permission Check
        if (role !== 'superadmin' && user.company_id !== company_id) {
            return res.status(403).json({ message: "No tienes permiso para editar este usuario." });
        }

        if (username) user.username = username;
        if (email) user.email = email;
        if (newRole && role === 'superadmin') user.role = newRole; // Only Superadmin can change roles freely
        if (password) user.password = bcrypt.hashSync(password, 8);

        await user.save();
        res.json({ message: "Usuario actualizado", user });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { company_id, role } = getContext(req);

        const user = await db.User.findByPk(id);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        if (role !== 'superadmin' && user.company_id !== company_id) {
            return res.status(403).json({ message: "No tienes permiso para eliminar este usuario." });
        }

        await user.destroy();
        res.json({ message: "Usuario eliminado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
