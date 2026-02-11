const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/admin/impersonate/:companyId', authController.impersonate);
router.post('/logout', authController.logout);

module.exports = router;
