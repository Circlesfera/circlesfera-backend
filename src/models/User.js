const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 160
  },
  avatar: {
    type: String
  },
  website: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  birthDate: {
    type: Date
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  savedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  preferences: {
    notifications: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      messages: { type: Boolean, default: true }
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showBirthDate: { type: Boolean, default: false }
    }
  },
  // Campo para rastrear usernames bloqueados
  blockedUsernames: [{
    type: String,
    lowercase: true,
    trim: true
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar el rendimiento
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });

// Virtuals
UserSchema.virtual('followersCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

UserSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

UserSchema.virtual('postsCount').get(function() {
  return this.posts ? this.posts.length : 0;
});

UserSchema.virtual('isFollowing').get(function() {
  return false; // Se calculará dinámicamente
});

// Métodos de instancia
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toPublicJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.email;
  delete user.phone;
  delete user.birthDate;
  delete user.blockedUsers;
  delete user.preferences;
  return user;
};

UserSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

// Middleware pre-save para encriptar contraseña
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Métodos estáticos
UserSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: username.toLowerCase() });
};

UserSchema.statics.searchUsers = function(query, limit = 10) {
  return this.find({
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { fullName: { $regex: query, $options: 'i' } }
    ],
    isActive: true
  }).limit(limit);
};

// Método para verificar si un username está disponible (no está en uso ni bloqueado)
UserSchema.statics.isUsernameAvailable = async function(username) {
  const normalizedUsername = username.toLowerCase().trim();
  
  // Verificar si el username está en uso
  const existingUser = await this.findOne({ username: normalizedUsername });
  if (existingUser) {
    return false;
  }
  
  // Verificar si el username está bloqueado por algún usuario
  const userWithBlockedUsername = await this.findOne({ 
    blockedUsernames: normalizedUsername 
  });
  
  return !userWithBlockedUsername;
};

// Método para bloquear un username
UserSchema.statics.blockUsername = async function(userId, username) {
  const normalizedUsername = username.toLowerCase().trim();
  return this.findByIdAndUpdate(
    userId,
    { $addToSet: { blockedUsernames: normalizedUsername } },
    { new: true }
  );
};

// Método para desbloquear un username
UserSchema.statics.unblockUsername = async function(userId, username) {
  const normalizedUsername = username.toLowerCase().trim();
  return this.findByIdAndUpdate(
    userId,
    { $pull: { blockedUsernames: normalizedUsername } },
    { new: true }
  );
};

module.exports = mongoose.model('User', UserSchema);
