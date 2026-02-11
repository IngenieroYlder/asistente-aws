const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const userController = require('../controllers/userController');
const companyController = require('../controllers/companyController');
const planController = require('../controllers/planController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Secure all API routes
router.use(verifyToken);

router.get('/stats', apiController.getStats);
router.get('/contacts', apiController.getContacts);
router.get('/sessions', apiController.getSessions); 
router.patch('/sessions/:id/pin', apiController.togglePin);
router.get('/messages/:sessionId', apiController.getMessages);
router.post('/pause-contact', apiController.pauseContact);
router.post('/send-manual', upload.array('files', 10), apiController.sendManualMessage);
router.post('/bulk-resume', apiController.bulkResumeBot);
router.get('/reports/stats', apiController.getReportingStats);

router.get('/assets', apiController.getAssets);
router.post('/assets', verifyAdmin, upload.array('files', 50), apiController.uploadAsset);
router.put('/assets/:id', verifyAdmin, apiController.updateAsset);
router.delete('/assets/:id', verifyAdmin, apiController.deleteAsset);

// Folders
router.get('/folders', verifyAdmin, apiController.getFolders);
router.post('/folders', verifyAdmin, apiController.createFolder);
router.delete('/folders/:id', verifyAdmin, apiController.deleteFolder);

router.get('/settings', verifyAdmin, apiController.getSettings);
router.post('/settings', verifyAdmin, apiController.updateSetting);

// Backups & Data
router.get('/backups', verifyAdmin, apiController.getBackups);
router.post('/backups', verifyAdmin, apiController.createBackup);
router.post('/backups/:id/restore', verifyAdmin, apiController.restoreBackup);
router.get('/export-config', verifyAdmin, apiController.exportConfig);
router.post('/import-config', verifyAdmin, apiController.importConfig);

// User Management Routes
router.get('/users', verifyAdmin, userController.getUsers);
router.post('/users', verifyAdmin, userController.createUser);
router.put('/users/:id', verifyAdmin, userController.updateUser);
router.delete('/users/:id', verifyAdmin, userController.deleteUser);

// SaaS Company Management (Superadmin Only)
// Note: Middleware 'verifyAdmin' allows 'admin' and 'superadmin'.
// We should strictly restrict this to superadmin inside the controller or separate middleware.
// For now, let's rely on UI hiding + controller logic if needed.
// SaaS Company Management (Superadmin Only)
router.get('/admin/saas-overview', verifyAdmin, apiController.getSaaSOverview);
router.get('/admin/companies/:companyId/settings', verifyAdmin, apiController.getCompanySettings);
router.put('/companies/:id', verifyAdmin, companyController.updateCompany);
router.put('/companies/:id/status', verifyAdmin, companyController.toggleStatus);
router.post('/companies/:id/subscription', verifyAdmin, companyController.updateSubscription);
router.post('/companies/:id/password', verifyAdmin, companyController.changeAdminPassword);
router.post('/companies/:id/branding', verifyAdmin, upload.array('files', 1), companyController.updateBranding);
router.post('/companies/:id/branding', verifyAdmin, upload.array('files', 1), companyController.updateBranding);
router.patch('/companies/:id/branding', verifyAdmin, companyController.updateBrandingUrl);

// Plan Management
router.get('/plans', verifyAdmin, planController.getPlans);
router.post('/plans', verifyAdmin, planController.createPlan); // Superadmin check inside controller
router.put('/plans/:id', verifyAdmin, planController.updatePlan);
router.delete('/plans/:id', verifyAdmin, planController.deletePlan);

module.exports = router;
