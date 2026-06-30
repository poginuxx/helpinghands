const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const wrap = require('../middleware/asyncHandler');
const { getSummary, getChart, getTopMedicines, exportCSV } = require('../controllers/reportsController');

router.use(auth);
router.get('/summary', wrap(getSummary));
router.get('/chart', wrap(getChart));
router.get('/top-medicines', wrap(getTopMedicines));
router.get('/export', wrap(exportCSV));

module.exports = router;
