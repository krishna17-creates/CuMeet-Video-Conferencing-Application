/**
 * Authentication Controller
 * Handles user registration, login, and profile management
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Register a new user
 */
const register = async (email, password, name) => {
  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      throw new Error('User already exists');
    }

    // Create new user
    user = new User({
      email,
      password,
      name,
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AuthController] User registered: ${email}`);

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error('[AuthController] Registration error:', error.message);
    throw error;
  }
};

/**
 * Login user
 */
const login = async (email, password) => {
  try {
    // Check user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AuthController] User logged in: ${email}`);

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error('[AuthController] Login error:', error.message);
    throw error;
  }
};

/**
 * Get current user profile
 */
const getCurrentUser = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    console.error('[AuthController] Error getting user:', error.message);
    throw error;
  }
};

/**
 * Update user profile
 */
const updateProfile = async (userId, updates) => {
  try {
    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
    }).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    console.log(`[AuthController] User profile updated: ${userId}`);
    return user;
  } catch (error) {
    console.error('[AuthController] Error updating profile:', error.message);
    throw error;
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  updatePassword: async (userId, currentPassword, newPassword) => {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw new Error('Current password is incorrect');
      }

      user.password = newPassword;
      await user.save();

      console.log(`[AuthController] Password updated for user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('[AuthController] Error updating password:', error.message);
      throw error;
    }
  },
};
