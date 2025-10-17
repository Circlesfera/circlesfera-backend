/**
 * User Events - Domain Layer
 * Eventos de dominio para usuarios
 * Prepara la arquitectura para microservicios
 */

/**
 * Evento de usuario registrado
 */
export class UserRegisteredEvent {
  constructor(user) {
    this.type = 'USER_REGISTERED'
    this.version = '1.0'
    this.data = {
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      registeredAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de perfil de usuario actualizado
 */
export class UserProfileUpdatedEvent {
  constructor(user, updatedFields) {
    this.type = 'USER_PROFILE_UPDATED'
    this.version = '1.0'
    this.data = {
      userId: user.id,
      username: user.username,
      updatedFields: Object.keys(updatedFields),
      updatedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario eliminado
 */
export class UserDeletedEvent {
  constructor(userId, username) {
    this.type = 'USER_DELETED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      deletedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario desactivado
 */
export class UserDeactivatedEvent {
  constructor(userId, username, reason) {
    this.type = 'USER_DEACTIVATED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      reason,
      deactivatedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario reactivado
 */
export class UserReactivatedEvent {
  constructor(userId, username) {
    this.type = 'USER_REACTIVATED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      reactivatedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario seguido
 */
export class UserFollowedEvent {
  constructor(follower, following) {
    this.type = 'USER_FOLLOWED'
    this.version = '1.0'
    this.data = {
      followerId: follower.id,
      followerUsername: follower.username,
      followingId: following.id,
      followingUsername: following.username,
      followedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario dejado de seguir
 */
export class UserUnfollowedEvent {
  constructor(follower, following) {
    this.type = 'USER_UNFOLLOWED'
    this.version = '1.0'
    this.data = {
      followerId: follower.id,
      followerUsername: follower.username,
      followingId: following.id,
      followingUsername: following.username,
      unfollowedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario bloqueado
 */
export class UserBlockedEvent {
  constructor(blocker, blocked) {
    this.type = 'USER_BLOCKED'
    this.version = '1.0'
    this.data = {
      blockerId: blocker.id,
      blockerUsername: blocker.username,
      blockedId: blocked.id,
      blockedUsername: blocked.username,
      blockedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario desbloqueado
 */
export class UserUnblockedEvent {
  constructor(unblocker, unblocked) {
    this.type = 'USER_UNBLOCKED'
    this.version = '1.0'
    this.data = {
      unblockerId: unblocker.id,
      unblockerUsername: unblocker.username,
      unblockedId: unblocked.id,
      unblockedUsername: unblocked.username,
      unblockedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de cambio de contraseña
 */
export class PasswordChangedEvent {
  constructor(userId, username, changedAt) {
    this.type = 'PASSWORD_CHANGED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      changedAt: changedAt || new Date().toISOString(),
      source: 'auth-service'
    }
    this.source = 'auth-service'
  }
}

/**
 * Evento de inicio de sesión
 */
export class UserLoggedInEvent {
  constructor(user, loginData) {
    this.type = 'USER_LOGGED_IN'
    this.version = '1.0'
    this.data = {
      userId: user.id,
      username: user.username,
      loginAt: new Date().toISOString(),
      ipAddress: loginData.ipAddress,
      userAgent: loginData.userAgent,
      source: 'auth-service'
    }
    this.source = 'auth-service'
  }
}

/**
 * Evento de cierre de sesión
 */
export class UserLoggedOutEvent {
  constructor(userId, username, logoutData) {
    this.type = 'USER_LOGGED_OUT'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      logoutAt: new Date().toISOString(),
      sessionDuration: logoutData.sessionDuration,
      source: 'auth-service'
    }
    this.source = 'auth-service'
  }
}

/**
 * Evento de solicitud de reset de contraseña
 */
export class PasswordResetRequestedEvent {
  constructor(userId, email, resetToken) {
    this.type = 'PASSWORD_RESET_REQUESTED'
    this.version = '1.0'
    this.data = {
      userId,
      email,
      resetToken,
      requestedAt: new Date().toISOString(),
      source: 'auth-service'
    }
    this.source = 'auth-service'
  }
}

/**
 * Evento de reset de contraseña completado
 */
export class PasswordResetCompletedEvent {
  constructor(userId, email, resetAt) {
    this.type = 'PASSWORD_RESET_COMPLETED'
    this.version = '1.0'
    this.data = {
      userId,
      email,
      resetAt: resetAt || new Date().toISOString(),
      source: 'auth-service'
    }
    this.source = 'auth-service'
  }
}

/**
 * Evento de verificación de email
 */
export class EmailVerifiedEvent {
  constructor(userId, email, verifiedAt) {
    this.type = 'EMAIL_VERIFIED'
    this.version = '1.0'
    this.data = {
      userId,
      email,
      verifiedAt: verifiedAt || new Date().toISOString(),
      source: 'auth-service'
    }
    this.source = 'auth-service'
  }
}

/**
 * Evento de cambio de email
 */
export class EmailChangedEvent {
  constructor(userId, oldEmail, newEmail, changedAt) {
    this.type = 'EMAIL_CHANGED'
    this.version = '1.0'
    this.data = {
      userId,
      oldEmail,
      newEmail,
      changedAt: changedAt || new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de cambio de username
 */
export class UsernameChangedEvent {
  constructor(userId, oldUsername, newUsername, changedAt) {
    this.type = 'USERNAME_CHANGED'
    this.version = '1.0'
    this.data = {
      userId,
      oldUsername,
      newUsername,
      changedAt: changedAt || new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de actualización de configuración de privacidad
 */
export class PrivacySettingsUpdatedEvent {
  constructor(userId, username, updatedSettings) {
    this.type = 'PRIVACY_SETTINGS_UPDATED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      updatedSettings: Object.keys(updatedSettings),
      updatedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de actualización de configuración de notificaciones
 */
export class NotificationSettingsUpdatedEvent {
  constructor(userId, username, updatedSettings) {
    this.type = 'NOTIFICATION_SETTINGS_UPDATED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      updatedSettings: Object.keys(updatedSettings),
      updatedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de actualización de preferencias
 */
export class UserPreferencesUpdatedEvent {
  constructor(userId, username, updatedPreferences) {
    this.type = 'USER_PREFERENCES_UPDATED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      updatedPreferences: Object.keys(updatedPreferences),
      updatedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario reportado
 */
export class UserReportedEvent {
  constructor(reporter, reported, reason, description) {
    this.type = 'USER_REPORTED'
    this.version = '1.0'
    this.data = {
      reporterId: reporter.id,
      reporterUsername: reporter.username,
      reportedId: reported.id,
      reportedUsername: reported.username,
      reason,
      description,
      reportedAt: new Date().toISOString(),
      source: 'user-service'
    }
    this.source = 'user-service'
  }
}

/**
 * Evento de usuario verificado
 */
export class UserVerifiedEvent {
  constructor(userId, username, verifiedAt) {
    this.type = 'USER_VERIFIED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      verifiedAt: verifiedAt || new Date().toISOString(),
      source: 'admin-service'
    }
    this.source = 'admin-service'
  }
}

/**
 * Evento de usuario desverificado
 */
export class UserUnverifiedEvent {
  constructor(userId, username, unverifiedAt) {
    this.type = 'USER_UNVERIFIED'
    this.version = '1.0'
    this.data = {
      userId,
      username,
      unverifiedAt: unverifiedAt || new Date().toISOString(),
      source: 'admin-service'
    }
    this.source = 'admin-service'
  }
}
