const express = require('express');
const router = express.Router();
const metaService = require('../services/metaService');

router.get('/meta/:companyId', metaService.verifyWebhook);
router.post('/meta/:companyId', metaService.handleWebhook);

module.exports = router;
