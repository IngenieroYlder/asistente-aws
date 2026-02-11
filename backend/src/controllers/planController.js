const db = require('../database/models');

exports.getPlans = async (req, res) => {
    try {
        const plans = await db.Plan.findAll({
            order: [['price', 'ASC']]
        });
        res.json(plans);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createPlan = async (req, res) => {
    try {
        if (req.userRole !== 'superadmin') return res.status(403).json({ message: "Unauthorized" });
        
        const { name, price, max_slots, max_tokens, features, description } = req.body;
        const plan = await db.Plan.create({
            name,
            price,
            max_slots,
            max_tokens,
            features,
            description
        });
        
        res.json(plan);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        if (req.userRole !== 'superadmin') return res.status(403).json({ message: "Unauthorized" });
        
        const { id } = req.params;
        const plan = await db.Plan.findByPk(id);
        if (!plan) return res.status(404).json({ message: "Plan not found" });

        await plan.update(req.body);
        res.json(plan);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        if (req.userRole !== 'superadmin') return res.status(403).json({ message: "Unauthorized" });
        
        const { id } = req.params;
        // Check dependencies (Companies using this plan)
        const count = await db.Company.count({ where: { plan_id: id } });
        if (count > 0) return res.status(400).json({ message: "No se puede eliminar un plan en uso por empresas." });

        await db.Plan.destroy({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
