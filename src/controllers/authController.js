const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { config } = require('../utils/config');
const logger = require('../utils/logger');

// Generar token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
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
        errors: errors.array(),
      });
    }

    const { username, email, password, fullName } = req.body;

    // Verificar si el username está disponible
    const isUsernameAvailable = await User.isUsernameAvailable(username);
    if (!isUsernameAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Este nombre de usuario ya está en uso o está bloqueado',
      });
    }

    // Verificar si el email ya existe
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Este email ya está registrado',
      });
    }

    // Crear nuevo usuario
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      fullName: fullName || username,
    });

    await user.save();

    // Bloquear el username para este usuario
    await User.blockUsername(user._id, username);

    // Generar token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: sanitizeUser(user),
    });

  } catch (error) {
    logger.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: config.isDevelopment ? error.message : undefined,
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
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Buscar usuario por email o username
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email.toLowerCase() },
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta ha sido desactivada',
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
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
      user: sanitizeUser(user),
    });

  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: config.isDevelopment ? error.message : undefined,
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      user: sanitizeUser(user),
    });

  } catch (error) {
    logger.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
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
        errors: errors.array(),
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
      isPrivate,
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Manejar archivo de avatar si se subió
    if (req.files && req.files.avatar && req.files.avatar.length > 0) {
      const avatarFile = req.files.avatar[0];
      
      // Construir la URL del avatar usando la misma lógica que otros controladores
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const avatarUrl = `${baseUrl}/uploads/${avatarFile.filename}`;
      user.avatar = avatarUrl;
      
      logger.info(`Avatar actualizado para usuario ${user.username}: ${avatarUrl}`);
    }

    // Si se está cambiando el username
    if (username && username !== user.username) {
      // Verificar si el nuevo username está disponible
      const isAvailable = await User.isUsernameAvailable(username);

      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Este nombre de usuario ya está en uso o está bloqueado',
        });
      }

      // Desbloquear el username anterior
      await User.unblockUsername(user._id, user.username);

      // Bloquear el nuevo username
      await User.blockUsername(user._id, username);

      // Actualizar el username del usuario
      user.username = username.toLowerCase();
    }

    // Actualizar otros campos permitidos
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
      user: sanitizeUser(user),
    });

  } catch (error) {
    logger.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
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
        errors: errors.array(),
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual es incorrecta',
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });

  } catch (error) {
    logger.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

exports.logout = async (req, res) => {
  try {
    // En una implementación más avanzada, podrías invalidar el token
    // agregándolo a una lista negra en Redis

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
    });

  } catch (error) {
    logger.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });

  } catch (error) {
    logger.error('Error refrescando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Verificar disponibilidad de username
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username es requerido',
      });
    }

    const isAvailable = await User.isUsernameAvailable(username);

    res.json({
      success: true,
      available: isAvailable,
      username: username.toLowerCase(),
    });

  } catch (error) {
    logger.error('Error verificando disponibilidad de username:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};
