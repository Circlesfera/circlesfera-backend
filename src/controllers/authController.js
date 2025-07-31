const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generar token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Respuesta de usuario sin información sensible
const sanitizeUser = (user) => {
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.blockedUsers;
  delete userObj.preferences;
  return userObj;
};

exports.register = async (req, res) => {
  try {
    // Validar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { username, email, password, fullName } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() 
          ? 'Este email ya está registrado' 
          : 'Este nombre de usuario ya está en uso'
      });
    }

    // Crear nuevo usuario
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      fullName: fullName || username
    });

    await user.save();

    // Generar token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.login = async (req, res) => {
  try {
    // Validar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuario por email o username
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email.toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta ha sido desactivada'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Actualizar último acceso
    await user.updateLastSeen();

    // Generar token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const {
      username,
      fullName,
      bio,
      website,
      location,
      phone,
      gender,
      birthDate,
      isPrivate
    } = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Si se está cambiando el username, verificar que no exista
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: user._id } // Excluir el usuario actual
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Este nombre de usuario ya está en uso'
        });
      }
    }

    // Actualizar campos permitidos
    if (username !== undefined) user.username = username.toLowerCase();
    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (website !== undefined) user.website = website;
    if (location !== undefined) user.location = location;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (birthDate !== undefined) user.birthDate = birthDate;
    if (isPrivate !== undefined) user.isPrivate = isPrivate;

    await user.save();

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

exports.logout = async (req, res) => {
  try {
    // En una implementación más avanzada, podrías invalidar el token
    // agregándolo a una lista negra en Redis
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
