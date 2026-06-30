const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wrap = require('../middleware/asyncHandler');
const { getAll, getById, create, bulkDelete } = require('../controllers/transactionsController');

router.use(auth);
router.get('/', wrap(getAll));
router.get('/:id', wrap(getById));
router.post('/', wrap(create));
router.delete('/bulk', wrap(bulkDelete));

module.exports = router;
