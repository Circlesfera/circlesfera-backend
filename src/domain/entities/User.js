/**
 * User Entity - Domain Layer
 * Representa un usuario en el dominio de negocio
 * Contiene lógica de negocio y validaciones
 */

export class User {
  constructor(userData) {
    this.id = userData.id
    this.username = userData.username
    this.email = userData.email
    this.fullName = userData.fullName
    this.bio = userData.bio
    this.avatar = userData.avatar
    this.isVerified = userData.isVerified || false
    this.isActive = userData.isActive !== false
    this.role = userData.role || 'user'
    this.createdAt = userData.createdAt
    this.updatedAt = userData.updatedAt
    this.followersCount = userData.followersCount || 0
    this.followingCount = userData.followingCount || 0
    this.postsCount = userData.postsCount || 0
    this.privacySettings = userData.privacySettings || {}
    this.notificationSettings = userData.notificationSettings || {}
    this.blockedUsers = userData.blockedUsers || []
  }

  // Métodos de negocio
  canFollow(targetUser) {
    return this.id !== targetUser.id &&
      !this.isBlocked(targetUser) &&
      this.isActive &&
      targetUser.isActive
  }

  canBlock(targetUser) {
    return this.id !== targetUser.id && this.isActive
  }

  isBlocked(targetUser) {
    return this.blockedUsers.includes(targetUser.id)
  }

  canViewProfile(targetUser) {
    if (this.id === targetUser.id) {
      return true
    }
    if (!targetUser.isActive) {
      return false
    }
    if (this.isBlocked(targetUser) || targetUser.isBlocked(this)) {
      return false
    }

    // Verificar configuraciones de privacidad
    if (targetUser.privacySettings?.profileVisibility === 'private') {
      return this.isFollowing(targetUser)
    }

    return true
  }

  canSendMessage(targetUser) {
    return this.canViewProfile(targetUser) &&
      !targetUser.privacySettings?.blockMessages
  }

  isFollowing(targetUser) {
    // Este método se implementará cuando tengamos la relación de follows
    return false // Placeholder
  }

  // Validaciones de dominio
  isValidUsername() {
    const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/
    return usernameRegex.test(this.username)
  }

  isValidEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(this.email)
  }

  isValidBio() {
    return !this.bio || this.bio.length <= 160
  }

  isValidFullName() {
    return !this.fullName || this.fullName.length <= 50
  }

  // Métodos de transformación
  toPublicProfile() {
    return {
      id: this.id,
      username: this.username,
      fullName: this.fullName,
      bio: this.bio,
      avatar: this.avatar,
      isVerified: this.isVerified,
      followersCount: this.followersCount,
      followingCount: this.followingCount,
      postsCount: this.postsCount,
      createdAt: this.createdAt
    }
  }

  toPrivateProfile() {
    return {
      ...this.toPublicProfile(),
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      privacySettings: this.privacySettings,
      notificationSettings: this.notificationSettings,
      updatedAt: this.updatedAt
    }
  }

  // Métodos de actualización
  updateProfile(profileData) {
    if (profileData.fullName !== undefined) {
      this.fullName = profileData.fullName
    }
    if (profileData.bio !== undefined) {
      this.bio = profileData.bio
    }
    if (profileData.avatar !== undefined) {
      this.avatar = profileData.avatar
    }
    this.updatedAt = new Date()
  }

  updatePrivacySettings(settings) {
    this.privacySettings = { ...this.privacySettings, ...settings }
    this.updatedAt = new Date()
  }

  updateNotificationSettings(settings) {
    this.notificationSettings = { ...this.notificationSettings, ...settings }
    this.updatedAt = new Date()
  }

  blockUser(userId) {
    if (!this.blockedUsers.includes(userId)) {
      this.blockedUsers.push(userId)
      this.updatedAt = new Date()
    }
  }

  unblockUser(userId) {
    this.blockedUsers = this.blockedUsers.filter(id => id !== userId)
    this.updatedAt = new Date()
  }

  // Métodos de validación completa
  validate() {
    const errors = []

    if (!this.isValidUsername()) {
      errors.push('Username inválido')
    }

    if (!this.isValidEmail()) {
      errors.push('Email inválido')
    }

    if (!this.isValidBio()) {
      errors.push('Bio demasiado larga')
    }

    if (!this.isValidFullName()) {
      errors.push('Nombre completo demasiado largo')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Factory methods
  static create(userData) {
    const user = new User(userData)
    const validation = user.validate()

    if (!validation.isValid) {
      throw new Error(`Usuario inválido: ${validation.errors.join(', ')}`)
    }

    return user
  }

  static fromMongoose(userDoc) {
    if (!userDoc) {
      return null
    }

    return new User({
      id: userDoc._id.toString(),
      username: userDoc.username,
      email: userDoc.email,
      fullName: userDoc.fullName,
      bio: userDoc.bio,
      avatar: userDoc.avatar,
      isVerified: userDoc.isVerified,
      isActive: userDoc.isActive,
      role: userDoc.role,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt,
      followersCount: userDoc.followersCount,
      followingCount: userDoc.followingCount,
      postsCount: userDoc.postsCount,
      privacySettings: userDoc.privacySettings,
      notificationSettings: userDoc.notificationSettings,
      blockedUsers: userDoc.blockedUsers
    })
  }
}
