import User from '../models/User.js'
import Post from '../models/Post.js'
import Story from '../models/Story.js'
import Reel from '../models/Reel.js'
import Notification from '../models/Notification.js'
import { config } from '../utils/config.js'
import logger from '../utils/logger.js'

// Obtener perfil de usuario público
export const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params
    logger.info('getUserProfile - Buscando usuario:', { username, params: req.params })

    // Buscar case-insensitive para manejar datos legacy
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } })
      .select('-password -email -phone -preferences')
      .populate({
        path: 'posts',
        match: { isDeleted: false, isArchived: false },
        select: 'caption content createdAt type likes comments'
      })
      .populate('savedPosts', 'caption content createdAt')

    logger.info('getUserProfile - Usuario encontrado:', { found: !!user, username })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Obtener stories del usuario
    const stories = await Story.find({
      user: user._id,
      isDeleted: false,
      isPublic: true,
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })

    // Calcular estadísticas directamente desde la base de datos
    const postsCount = await Post.countDocuments({
      user: user._id,
      isDeleted: false,
      isArchived: false
    })

    const storiesCount = stories.length
    const reelsCount = await Reel.countDocuments({
      user: user._id,
      isDeleted: false
    })


    const followersCount = user.followers.length
    const followingCount = user.following.length

    // Calcular likes y comentarios totales
    const postsWithStats = await Post.find({
      user: user._id,
      isDeleted: false,
      isArchived: false
    }).select('likes comments')

    const totalLikes = postsWithStats.reduce((total, post) => {
      return total + (post.likes ? post.likes.length : 0)
    }, 0)

    const totalComments = postsWithStats.reduce((total, post) => {
      return total + (post.comments ? post.comments.length : 0)
    }, 0)

    // Verificar si el usuario actual está siguiendo a este usuario
    let isFollowing = false
    if (req.userId) {
      try {
        const currentUser = await User.findById(req.userId)
        if (currentUser) {
          // Convertir ambos a string para comparación correcta
          const profileUserIdStr = user._id.toString()
          isFollowing = currentUser.following.some(followingId => followingId.toString() === profileUserIdStr)

          logger.info('Follow status check:', {
            currentUserId: req.userId,
            profileUserId: profileUserIdStr,
            isFollowing,
            currentUserFollowing: currentUser.following.map(id => id.toString())
          })
        }
      } catch (error) {
        logger.error('Error checking follow status:', error)
        // Si hay error, asumir que no está siguiendo
        isFollowing = false
      }
    }

    const responseData = {
      ...user.toObject(),
      stories,
      postsCount,
      storiesCount,
      reelsCount,
      followersCount,
      followingCount,
      totalLikes,
      totalComments,
      isFollowing
    }

    logger.info('getUserProfile response:', {
      username: user.username,
      userId: user._id.toString(),
      isFollowing,
      reqUserId: req.userId,
      responseData: {
        ...responseData,
        followers: responseData.followers?.length || 0,
        following: responseData.following?.length || 0,
        posts: responseData.posts?.length || 0
      }
    })

    res.json({
      success: true,
      user: responseData
    })
  } catch (error) {
    logger.error('Error en getUserProfile:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener posts de un usuario
export const getUserPosts = async (req, res) => {
  try {
    const { username } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = config.getPaginationLimit(req.query.limit)
    const skip = (page - 1) * limit

    const user = await User.findOne({ username })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const posts = await Post.findByUser(user._id, { includeArchived: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Post.countDocuments({
      user: user._id,
      isDeleted: false,
      isArchived: false
    })

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getUserPosts:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener historias de un usuario
export const getUserStories = async (req, res) => {
  try {
    const { username } = req.params
    const user = await User.findOne({ username })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const stories = await Story.findByUser(user._id, { includeExpired: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      stories
    })
  } catch (error) {
    logger.error('Error en getUserStories:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Seguir a un usuario
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToFollow = await User.findById(userId)

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (userToFollow._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes seguirte a ti mismo'
      })
    }

    const currentUser = await User.findById(req.userId)

    // Verificar si ya está siguiendo usando comparación de strings
    const userToFollowIdStr = userToFollow._id.toString()
    const isAlreadyFollowing = currentUser.following.some(followingId => followingId.toString() === userToFollowIdStr)

    if (isAlreadyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'Ya estás siguiendo a este usuario'
      })
    }

    // Agregar a following
    currentUser.following.push(userToFollow._id)
    await currentUser.save()

    // Agregar a followers del usuario seguido
    userToFollow.followers.push(currentUser._id)
    await userToFollow.save()

    // Crear notificación
    await Notification.create({
      user: userToFollow._id,
      type: 'follow',
      from: currentUser._id,
      message: `${currentUser.username} comenzó a seguirte`
    })

    res.json({
      success: true,
      message: 'Usuario seguido exitosamente'
    })
  } catch (error) {
    logger.error('Error en followUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Dejar de seguir a un usuario
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToUnfollow = await User.findById(userId)

    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (userToUnfollow._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes dejar de seguirte a ti mismo'
      })
    }

    const currentUser = await User.findById(req.userId)

    // Verificar si está siguiendo usando comparación de strings
    const userToUnfollowIdStr = userToUnfollow._id.toString()
    const isCurrentlyFollowing = currentUser.following.some(followingId => followingId.toString() === userToUnfollowIdStr)

    if (!isCurrentlyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'No estás siguiendo a este usuario'
      })
    }

    // Remover de following
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userToUnfollow._id.toString()
    )
    await currentUser.save()

    // Remover de followers del usuario
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUser._id.toString()
    )
    await userToUnfollow.save()

    res.json({
      success: true,
      message: 'Usuario dejado de seguir exitosamente'
    })
  } catch (error) {
    logger.error('Error en unfollowUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener seguidores de un usuario
export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username avatar fullName bio',
        options: { skip, limit }
      })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Filtrar para excluir al propio usuario y añadir información de seguimiento
    const followersWithStatus = user.followers
      .filter(follower => follower._id.toString() !== userId) // Excluir al propio usuario
      .map(follower => {
        const userObj = follower.toObject()
        // Si hay un usuario autenticado, verificar si está siguiendo
        if (req.userId) {
          // Verificar si el usuario actual está siguiendo a este seguidor
          userObj.isFollowing = req.userId && user.following && user.following.includes(follower._id)
        }
        return userObj
      })

    const total = followersWithStatus.length // Total después de filtrar

    res.json({
      success: true,
      followers: followersWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getFollowers:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener usuarios que sigue
export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username avatar fullName bio',
        options: { skip, limit }
      })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Filtrar para excluir al propio usuario y añadir información de seguimiento
    const followingWithStatus = user.following
      .filter(followedUser => followedUser._id.toString() !== userId) // Excluir al propio usuario
      .map(followedUser => {
        const userObj = followedUser.toObject()
        // Si hay un usuario autenticado, verificar si está siguiendo
        if (req.userId) {
          userObj.isFollowing = true // En getFollowing, todos los usuarios ya están siendo seguidos
        }
        return userObj
      })

    const total = followingWithStatus.length // Total después de filtrar

    res.json({
      success: true,
      following: followingWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getFollowing:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Buscar usuarios
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query
    const page = parseInt(req.query.page) || 1
    const limit = config.getPaginationLimit(req.query.limit || 20)

    if (!q || q.trim().length < config.minSearchLength) {
      return res.status(400).json({
        success: false,
        message: `El término de búsqueda debe tener al menos ${config.minSearchLength} caracteres`
      })
    }

    // Query optimizada con lean() y select
    const query = {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('username avatar fullName bio isVerified')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ])

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en searchUsers:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Bloquear usuario
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToBlock = await User.findById(userId)

    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (userToBlock._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes bloquearte a ti mismo'
      })
    }

    const currentUser = await User.findById(req.userId)

    if (currentUser.blockedUsers.includes(userToBlock._id)) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes bloqueado a este usuario'
      })
    }

    currentUser.blockedUsers.push(userToBlock._id)
    await currentUser.save()

    res.json({
      success: true,
      message: 'Usuario bloqueado exitosamente'
    })
  } catch (error) {
    logger.error('Error en blockUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Desbloquear usuario
export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToUnblock = await User.findById(userId)

    if (!userToUnblock) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (userToUnblock._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desbloquearte a ti mismo'
      })
    }

    const currentUser = await User.findById(req.userId)

    if (!currentUser.blockedUsers.includes(userToUnblock._id)) {
      return res.status(400).json({
        success: false,
        message: 'No tienes bloqueado a este usuario'
      })
    }

    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      id => !id.equals(userToUnblock._id)
    )
    await currentUser.save()

    res.json({
      success: true,
      message: 'Usuario desbloqueado exitosamente'
    })
  } catch (error) {
    logger.error('Error en unblockUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener usuarios bloqueados
export const getBlockedUsers = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId)
      .populate('blockedUsers', 'username avatar fullName')

    res.json({
      success: true,
      blockedUsers: currentUser.blockedUsers
    })
  } catch (error) {
    logger.error('Error en getBlockedUsers:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener sugerencias de usuarios
export const getUserSuggestions = async (req, res) => {
  try {
    const limit = config.getPaginationLimit(req.query.limit || 10)
    const currentUser = await User.findById(req.userId)
      .select('following blockedUsers')
      .lean()

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Query optimizada con lean() para mejor rendimiento
    const suggestions = await User.find({
      _id: {
        $nin: [
          ...(currentUser.following || []),
          ...(currentUser.blockedUsers || []),
          currentUser._id
        ]
      },
      isActive: true
    })
      .select('username avatar fullName bio')
      .sort({ 'followers.length': -1, createdAt: -1 })
      .limit(limit)
      .lean()

    res.json({
      success: true,
      suggestions
    })
  } catch (error) {
    logger.error('Error en getUserSuggestions:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener configuraciones del usuario
export const getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Configuraciones por defecto si no existen
    const settings = {
      privacy: {
        isPrivate: user.isPrivate || false,
        allowMessages: user.allowMessages || 'all',
        showEmail: user.showEmail || false,
        showPhone: user.showPhone || false,
        showBirthDate: user.showBirthDate || false
      },
      notifications: {
        likes: user.notifications?.likes ?? true,
        comments: user.notifications?.comments ?? true,
        follows: user.notifications?.follows ?? true,
        mentions: user.notifications?.mentions ?? true,
        messages: user.notifications?.messages ?? true,
        stories: user.notifications?.stories ?? true,
        posts: user.notifications?.posts ?? true
      },
      security: {
        twoFactorEnabled: user.twoFactorEnabled || false,
        loginNotifications: user.loginNotifications ?? true,
        suspiciousActivityAlerts: user.suspiciousActivityAlerts ?? true
      }
    }

    res.json({
      success: true,
      settings
    })
  } catch (error) {
    logger.error('Error getting user settings:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar configuraciones de privacidad
export const updatePrivacySettings = async (req, res) => {
  try {
    const { isPrivate, allowMessages, showEmail, showPhone, showBirthDate } = req.body

    const updateData = {}
    if (typeof isPrivate === 'boolean') updateData.isPrivate = isPrivate
    if (allowMessages) updateData.allowMessages = allowMessages
    if (typeof showEmail === 'boolean') updateData.showEmail = showEmail
    if (typeof showPhone === 'boolean') updateData.showPhone = showPhone
    if (typeof showBirthDate === 'boolean') updateData.showBirthDate = showBirthDate

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      message: 'Configuración de privacidad actualizada correctamente'
    })
  } catch (error) {
    logger.error('Error updating privacy settings:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar configuraciones de notificaciones
export const updateNotificationSettings = async (req, res) => {
  try {
    const { likes, comments, follows, mentions, messages, stories, posts } = req.body

    const notificationSettings = {}
    if (typeof likes === 'boolean') notificationSettings.likes = likes
    if (typeof comments === 'boolean') notificationSettings.comments = comments
    if (typeof follows === 'boolean') notificationSettings.follows = follows
    if (typeof mentions === 'boolean') notificationSettings.mentions = mentions
    if (typeof messages === 'boolean') notificationSettings.messages = messages
    if (typeof stories === 'boolean') notificationSettings.stories = stories
    if (typeof posts === 'boolean') notificationSettings.posts = posts

    const user = await User.findByIdAndUpdate(
      req.userId,
      { notifications: notificationSettings },
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      message: 'Configuración de notificaciones actualizada correctamente'
    })
  } catch (error) {
    logger.error('Error updating notification settings:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar configuraciones de seguridad
export const updateSecuritySettings = async (req, res) => {
  try {
    const { loginNotifications, suspiciousActivityAlerts } = req.body

    const updateData = {}
    if (typeof loginNotifications === 'boolean') updateData.loginNotifications = loginNotifications
    if (typeof suspiciousActivityAlerts === 'boolean') updateData.suspiciousActivityAlerts = suspiciousActivityAlerts

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      message: 'Configuración de seguridad actualizada correctamente'
    })
  } catch (error) {
    logger.error('Error updating security settings:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Cambiar contraseña
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva contraseña son requeridas'
      })
    }

    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar contraseña actual
    const isPasswordValid = await user.comparePassword(currentPassword)
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      })
    }

    // Validar nueva contraseña
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres'
      })
    }

    // Actualizar contraseña
    user.password = newPassword
    await user.save()

    res.json({
      success: true,
      message: 'Contraseña cambiada correctamente'
    })
  } catch (error) {
    logger.error('Error changing password:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Habilitar/deshabilitar autenticación de dos factores
export const toggleTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'El parámetro enabled es requerido'
      })
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { twoFactorEnabled: enabled },
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      message: enabled ? '2FA habilitado correctamente' : '2FA deshabilitado correctamente'
    })
  } catch (error) {
    logger.error('Error toggling 2FA:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Silenciar a un usuario
export const muteUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToMute = await User.findById(userId)

    if (!userToMute) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (userToMute._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes silenciarte a ti mismo'
      })
    }

    const currentUser = await User.findById(req.userId)

    if (currentUser.mutedUsers.includes(userToMute._id)) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes silenciado a este usuario'
      })
    }

    // Agregar a usuarios silenciados
    currentUser.mutedUsers.push(userToMute._id)
    await currentUser.save()

    res.json({
      success: true,
      message: 'Usuario silenciado exitosamente'
    })
  } catch (error) {
    logger.error('Error en muteUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Desilenciar a un usuario
export const unmuteUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToUnmute = await User.findById(userId)

    if (!userToUnmute) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const currentUser = await User.findById(req.userId)

    if (!currentUser.mutedUsers.includes(userToUnmute._id)) {
      return res.status(400).json({
        success: false,
        message: 'No tienes silenciado a este usuario'
      })
    }

    // Remover de usuarios silenciados
    currentUser.mutedUsers = currentUser.mutedUsers.filter(
      id => id.toString() !== userToUnmute._id.toString()
    )
    await currentUser.save()

    res.json({
      success: true,
      message: 'Usuario desilenciado exitosamente'
    })
  } catch (error) {
    logger.error('Error en unmuteUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Restringir a un usuario
export const restrictUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToRestrict = await User.findById(userId)

    if (!userToRestrict) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (userToRestrict._id.toString() === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes restringirte a ti mismo'
      })
    }

    const currentUser = await User.findById(req.userId)

    if (currentUser.restrictedUsers.includes(userToRestrict._id)) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes restringido a este usuario'
      })
    }

    // Agregar a usuarios restringidos
    currentUser.restrictedUsers.push(userToRestrict._id)
    await currentUser.save()

    res.json({
      success: true,
      message: 'Usuario restringido exitosamente'
    })
  } catch (error) {
    logger.error('Error en restrictUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Desrestringir a un usuario
export const unrestrictUser = async (req, res) => {
  try {
    const { userId } = req.params
    const userToUnrestrict = await User.findById(userId)

    if (!userToUnrestrict) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const currentUser = await User.findById(req.userId)

    if (!currentUser.restrictedUsers.includes(userToUnrestrict._id)) {
      return res.status(400).json({
        success: false,
        message: 'No tienes restringido a este usuario'
      })
    }

    // Remover de usuarios restringidos
    currentUser.restrictedUsers = currentUser.restrictedUsers.filter(
      id => id.toString() !== userToUnrestrict._id.toString()
    )
    await currentUser.save()

    res.json({
      success: true,
      message: 'Usuario desrestringido exitosamente'
    })
  } catch (error) {
    logger.error('Error en unrestrictUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
