/**
 * Post Entity - Domain Layer
 * Representa una publicación en el dominio de negocio
 * Contiene lógica de negocio específica de posts
 */

export class Post {
  constructor(postData) {
    this.id = postData.id
    this.userId = postData.userId
    this.type = postData.type || 'text'
    this.caption = postData.caption || ''
    this.content = postData.content || {}
    this.location = postData.location || null
    this.tags = postData.tags || []
    this.mentions = postData.mentions || []
    this.likes = postData.likes || []
    this.comments = postData.comments || []
    this.shares = postData.shares || 0
    this.views = postData.views || 0
    this.isPublic = postData.isPublic !== false
    this.isActive = postData.isActive !== false
    this.createdAt = postData.createdAt
    this.updatedAt = postData.updatedAt
  }

  // Métodos de negocio
  canBeViewedBy(viewer) {
    if (!this.isActive) return false
    if (!this.isPublic && this.userId !== viewer.id) return false

    return true
  }

  canBeLikedBy(user) {
    return this.canBeViewedBy(user) &&
      !this.likes.includes(user.id) &&
      this.userId !== user.id
  }

  canBeUnlikedBy(user) {
    return this.likes.includes(user.id)
  }

  canBeCommentedBy(user) {
    return this.canBeViewedBy(user) && this.userId !== user.id
  }

  canBeEditedBy(user) {
    return this.userId === user.id || user.role === 'admin'
  }

  canBeDeletedBy(user) {
    return this.userId === user.id || user.role === 'admin'
  }

  canBeSharedBy(user) {
    return this.canBeViewedBy(user) && this.isPublic
  }

  // Métodos de interacción
  addLike(userId) {
    if (!this.likes.includes(userId)) {
      this.likes.push(userId)
      this.updatedAt = new Date()
    }
  }

  removeLike(userId) {
    this.likes = this.likes.filter(id => id !== userId)
    this.updatedAt = new Date()
  }

  addComment(commentId) {
    this.comments.push(commentId)
    this.updatedAt = new Date()
  }

  removeComment(commentId) {
    this.comments = this.comments.filter(id => id !== commentId)
    this.updatedAt = new Date()
  }

  incrementViews() {
    this.views += 1
    this.updatedAt = new Date()
  }

  incrementShares() {
    this.shares += 1
    this.updatedAt = new Date()
  }

  // Métodos de contenido
  hasMedia() {
    return this.type !== 'text' &&
      (this.content.images?.length > 0 || this.content.video)
  }

  getMediaCount() {
    if (this.content.images) {
      return this.content.images.length
    }
    if (this.content.video) {
      return 1
    }
    return 0
  }

  getEngagementScore() {
    return this.likes.length + (this.comments.length * 2) + this.shares
  }

  getEngagementRate(totalViews = 0) {
    if (totalViews === 0) return 0
    return (this.getEngagementScore() / totalViews) * 100
  }

  // Validaciones de dominio
  isValidCaption() {
    return !this.caption || this.caption.length <= 2200
  }

  isValidTags() {
    return this.tags.length <= 30 &&
      this.tags.every(tag => tag.length <= 50)
  }

  isValidMentions() {
    return this.mentions.length <= 20
  }

  isValidContent() {
    switch (this.type) {
      case 'text':
        return this.caption.length > 0
      case 'image':
        return this.content.images?.length > 0 && this.content.images.length <= 10
      case 'video':
        return this.content.video
      default:
        return false
    }
  }

  // Métodos de transformación
  toPublicPost() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      caption: this.caption,
      content: this.content,
      location: this.location,
      tags: this.tags,
      mentions: this.mentions,
      likesCount: this.likes.length,
      commentsCount: this.comments.length,
      shares: this.shares,
      views: this.views,
      isPublic: this.isPublic,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  toFeedPost() {
    return {
      ...this.toPublicPost(),
      // Para el feed, podríamos incluir información adicional del usuario
    }
  }

  // Métodos de actualización
  updateCaption(newCaption) {
    if (newCaption && newCaption.length <= 2200) {
      this.caption = newCaption
      this.updatedAt = new Date()
    }
  }

  updateTags(newTags) {
    if (newTags && newTags.length <= 30) {
      this.tags = newTags.filter(tag => tag.length <= 50)
      this.updatedAt = new Date()
    }
  }

  updateLocation(newLocation) {
    this.location = newLocation
    this.updatedAt = new Date()
  }

  setVisibility(isPublic) {
    this.isPublic = isPublic
    this.updatedAt = new Date()
  }

  // Métodos de validación completa
  validate() {
    const errors = []

    if (!this.isValidCaption()) {
      errors.push('Caption demasiado largo')
    }

    if (!this.isValidTags()) {
      errors.push('Tags inválidos')
    }

    if (!this.isValidMentions()) {
      errors.push('Demasiadas menciones')
    }

    if (!this.isValidContent()) {
      errors.push('Contenido inválido')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Factory methods
  static create(postData) {
    const post = new Post(postData)
    const validation = post.validate()

    if (!validation.isValid) {
      throw new Error(`Post inválido: ${validation.errors.join(', ')}`)
    }

    return post
  }

  static fromMongoose(postDoc) {
    if (!postDoc) return null

    return new Post({
      id: postDoc._id.toString(),
      userId: postDoc.user?.toString() || postDoc.userId,
      type: postDoc.type,
      caption: postDoc.caption,
      content: postDoc.content,
      location: postDoc.location,
      tags: postDoc.tags,
      mentions: postDoc.mentions,
      likes: postDoc.likes?.map(like => like.toString()) || [],
      comments: postDoc.comments || [],
      shares: postDoc.shares,
      views: postDoc.views,
      isPublic: postDoc.isPublic,
      isActive: postDoc.isActive,
      createdAt: postDoc.createdAt,
      updatedAt: postDoc.updatedAt
    })
  }
}
