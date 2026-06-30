const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wrap = require('../middleware/asyncHandler');
const { getAll, create, update, remove } = require('../controllers/suppliersController');

router.use(auth);
router.get('/', wrap(getAll));
router.post('/', wrap(create));
router.put('/:id', wrap(update));
router.delete('/:id', wrap(remove));

module.exports = router;
