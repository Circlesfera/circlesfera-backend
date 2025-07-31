const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'El nombre de usuario es requerido'],
    unique: true,
    trim: true,
    minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
    maxlength: [30, 'El nombre de usuario no puede exceder 30 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingresa un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [160, 'La biografía no puede exceder 160 caracteres'],
    default: ''
  },
  fullName: {
    type: String,
    trim: true,
    maxlength: [50, 'El nombre completo no puede exceder 50 caracteres']
  },
  website: {
    type: String,
    match: [/^https?:\/\/.+/, 'La URL debe comenzar con http:// o https://']
  },
  location: {
    type: String,
    maxlength: [100, 'La ubicación no puede exceder 100 caracteres']
  },
  phone: {
    type: String,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Por favor ingresa un número de teléfono válido']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    default: 'prefer-not-to-say'
  },
  birthDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v < new Date();
      },
      message: 'La fecha de nacimiento no puede ser en el futuro'
    }
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
    ref: 'User',
    index: true
  }],
  following: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true
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
  }
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
  return this.followers.length;
});

UserSchema.virtual('followingCount').get(function() {
  return this.following.length;
});

UserSchema.virtual('postsCount').get(function() {
  return this.posts.length;
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

module.exports = mongoose.model('User', UserSchema);
