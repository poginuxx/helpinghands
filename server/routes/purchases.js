const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wrap = require('../middleware/asyncHandler');
const { getAll, getById, create, receive } = require('../controllers/purchasesController');

router.use(auth);
router.get('/', wrap(getAll));
router.get('/:id', wrap(getById));
router.post('/', wrap(create));
router.patch('/:id/receive', wrap(receive));

module.exports = router;
