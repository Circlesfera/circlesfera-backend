const User = require('../models/User');
const Post = require('../models/Post');
const Story = require('../models/Story');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// Obtener perfil de usuario público
exports.getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username })
      .select('-password -email -phone -preferences')
      .populate('posts', 'caption content createdAt')
      .populate('savedPosts', 'caption content createdAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el usuario actual está siguiendo a este usuario
    let isFollowing = false;
    if (req.userId) {
      const currentUser = await User.findById(req.userId);
      isFollowing = currentUser.following.includes(user._id);
    }

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        isFollowing
      }
    });
  } catch (error) {
    console.error('Error en getUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener posts de un usuario
exports.getUserPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const posts = await Post.findByUser(user._id, { includeArchived: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({
      user: user._id,
      isDeleted: false,
      isArchived: false
    });

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getUserPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener historias de un usuario
exports.getUserStories = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const stories = await Story.findByUser(user._id, { includeExpired: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      stories
    });
  } catch (error) {
    console.error('Error en getUserStories:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Seguir a un usuario
exports.followUser = async (req, res) => {
  try {
    const { username } = req.params;
    const userToFollow = await User.findOne({ username });
    
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (userToFollow._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes seguirte a ti mismo'
      });
    }

    const currentUser = await User.findById(req.userId);
    
    if (currentUser.following.includes(userToFollow._id)) {
      return res.status(400).json({
        success: false,
        message: 'Ya estás siguiendo a este usuario'
      });
    }

    // Agregar a following
    currentUser.following.push(userToFollow._id);
    await currentUser.save();

    // Agregar a followers del usuario seguido
    userToFollow.followers.push(currentUser._id);
    await userToFollow.save();

    // Crear notificación
    await Notification.create({
      user: userToFollow._id,
      type: 'follow',
      from: currentUser._id,
      message: `${currentUser.username} comenzó a seguirte`
    });

    res.json({
      success: true,
      message: 'Usuario seguido exitosamente'
    });
  } catch (error) {
    console.error('Error en followUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Dejar de seguir a un usuario
exports.unfollowUser = async (req, res) => {
  try {
    const { username } = req.params;
    const userToUnfollow = await User.findOne({ username });
    
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentUser = await User.findById(req.userId);
    
    if (!currentUser.following.includes(userToUnfollow._id)) {
      return res.status(400).json({
        success: false,
        message: 'No estás siguiendo a este usuario'
      });
    }

    // Remover de following
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userToUnfollow._id.toString()
    );
    await currentUser.save();

    // Remover de followers del usuario
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUser._id.toString()
    );
    await userToUnfollow.save();

    res.json({
      success: true,
      message: 'Usuario dejado de seguir exitosamente'
    });
  } catch (error) {
    console.error('Error en unfollowUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener seguidores de un usuario
exports.getFollowers = async (req, res) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username })
      .populate({
        path: 'followers',
        select: 'username avatar fullName bio',
        options: { skip, limit }
      });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const total = user.followers.length;

    res.json({
      success: true,
      followers: user.followers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getFollowers:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener usuarios que sigue
exports.getFollowing = async (req, res) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username })
      .populate({
        path: 'following',
        select: 'username avatar fullName bio',
        options: { skip, limit }
      });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const total = user.following.length;

    res.json({
      success: true,
      following: user.following,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getFollowing:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Buscar usuarios
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El término de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const users = await User.searchUsers(q, { skip, limit });
    const total = await User.countDocuments({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    });

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en searchUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Bloquear usuario
exports.blockUser = async (req, res) => {
  try {
    const { username } = req.params;
    const userToBlock = await User.findOne({ username });
    
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (userToBlock._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes bloquearte a ti mismo'
      });
    }

    const currentUser = await User.findById(req.userId);
    
    if (currentUser.blockedUsers.includes(userToBlock._id)) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes bloqueado a este usuario'
      });
    }

    currentUser.blockedUsers.push(userToBlock._id);
    await currentUser.save();

    res.json({
      success: true,
      message: 'Usuario bloqueado exitosamente'
    });
  } catch (error) {
    console.error('Error en blockUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Desbloquear usuario
exports.unblockUser = async (req, res) => {
  try {
    const { username } = req.params;
    const userToUnblock = await User.findOne({ username });
    
    if (!userToUnblock) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const currentUser = await User.findById(req.userId);
    
    if (!currentUser.blockedUsers.includes(userToUnblock._id)) {
      return res.status(400).json({
        success: false,
        message: 'No tienes bloqueado a este usuario'
      });
    }

    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      id => !id.equals(userToUnblock._id)
    );
    await currentUser.save();

    res.json({
      success: true,
      message: 'Usuario desbloqueado exitosamente'
    });
  } catch (error) {
    console.error('Error en unblockUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener usuarios bloqueados
exports.getBlockedUsers = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId)
      .populate('blockedUsers', 'username avatar fullName');

    res.json({
      success: true,
      blockedUsers: currentUser.blockedUsers
    });
  } catch (error) {
    console.error('Error en getBlockedUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener sugerencias de usuarios
exports.getUserSuggestions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const currentUser = await User.findById(req.userId);
    
    // Obtener usuarios que no sigue y no están bloqueados
    const suggestions = await User.find({
      _id: { 
        $nin: [...currentUser.following, ...currentUser.blockedUsers, currentUser._id] 
      },
      isActive: true
    })
    .select('username avatar fullName bio followersCount')
    .sort({ followersCount: -1 })
    .limit(limit);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error en getUserSuggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
