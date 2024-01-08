const router = require('express').Router();
const verifyToken = require('../middlewares/jwtVerification');
const {
    addLogController,
    updateLogController
} = require('../controllers/userLogController');

// Endpoint to add a log
router.post('/', verifyToken, addLogController);

// Endpoint to update a log
router.put('/:id', verifyToken, updateLogController);

module.exports = router;