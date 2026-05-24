const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// Register new user
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await authController.register(email, password, name);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token: user.token,
      user: user.user
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'SIGNUP_ERROR',
        message: error.message || 'Server error during signup'
      }
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authController.login(email, password);

    res.json({
      success: true,
      message: 'Login successful',
      token: user.token,
      user: user.user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: error.message || 'Server error during login'
      }
    });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await authController.getCurrentUser(req.user.userId);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'GET_USER_ERROR',
        message: error.message || 'Server error'
      }
    });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await authController.updateProfile(req.user.userId, { name, email });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'UPDATE_PROFILE_ERROR',
        message: error.message || 'Server error during profile update'
      }
    });
  }
});

// Update password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authController.updatePassword(req.user.userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'UPDATE_PASSWORD_ERROR',
        message: error.message || 'Server error during password update'
      }
    });
  }
});

module.exports = router;