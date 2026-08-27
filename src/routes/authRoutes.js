const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { loginLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const {
  registerValidators,
  loginValidators,
  newPasswordValidators,
  handleValidation,
} = require('../middleware/validators');
const controller = require('../controllers/authController');

router.post('/register', registerLimiter, registerValidators, handleValidation, controller.register);
router.post('/login', loginLimiter, loginValidators, handleValidation, controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.post('/password-reset/request', passwordResetLimiter, controller.requestPasswordReset);
router.post(
  '/password-reset/confirm',
  newPasswordValidators,
  handleValidation,
  controller.resetPassword
);
router.get('/me', authenticate, controller.me);

module.exports = router;
