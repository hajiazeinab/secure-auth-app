const { body, validationResult } = require('express-validator');

const passwordRules = body('password')
  .isLength({ min: 10 })
  .withMessage('Password must be at least 10 characters long')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain a number')
  .matches(/[^A-Za-z0-9]/)
  .withMessage('Password must contain a symbol');

const registerValidators = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  passwordRules,
];

const loginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const newPasswordValidators = [passwordRules];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map((e) => e.msg) });
  }
  next();
}

module.exports = {
  registerValidators,
  loginValidators,
  newPasswordValidators,
  handleValidation,
};
