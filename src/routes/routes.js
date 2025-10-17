/**
 * 🛣️ REFACTORED ROUTES
 * =====================
 * Rutas refactorizadas usando los nuevos controladores
 * Implementa validaciones unificadas y manejo de errores consistente
 */

import express from 'express'
import { auth } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'
import validationHandler from '../middlewares/validationHandler.js'

// Importar controladores refactorizados
import { authController, AuthController } from '../controllers/refactoredAuthController.js'
import { postController, PostController } from '../controllers/refactoredPostController.js'
import { userController, UserController } from '../controllers/refactoredUserController.js'
import { commentController, CommentController } from '../controllers/refactoredCommentController.js'
import { storyController, StoryController } from '../controllers/refactoredStoryController.js'
import { messageController, MessageController } from '../controllers/refactoredMessageController.js'
import { conversationController, ConversationController } from '../controllers/refactoredConversationController.js'
import { notificationController, NotificationController } from '../controllers/refactoredNotificationController.js'
import { reelController, RefactoredReelController } from '../controllers/refactoredReelController.js'
import { liveStreamController, RefactoredLiveStreamController } from '../controllers/refactoredLiveStreamController.js'
import { analyticsController, RefactoredAnalyticsController } from '../controllers/refactoredAnalyticsController.js'

const router = express.Router()

// ========================================
// RUTAS DE AUTENTICACIÓN
// ========================================
const authRoutes = express.Router()

// Registro
authRoutes.post(
  '/register',
  AuthController.registerValidations,
  validationHandler,
  authController.register.bind(authController)
)

// Login
authRoutes.post(
  '/login',
  AuthController.loginValidations,
  validationHandler,
  authController.login.bind(authController)
)

// Logout (protegida)
authRoutes.post(
  '/logout',
  auth,
  authController.logout.bind(authController)
)

// Refresh token
authRoutes.post(
  '/refresh',
  authController.refreshToken.bind(authController)
)

// Solicitar reset de contraseña
authRoutes.post(
  '/forgot-password',
  AuthController.resetPasswordValidations,
  validationHandler,
  authController.forgotPassword.bind(authController)
)

// Reset de contraseña
authRoutes.post(
  '/reset-password',
  authController.resetPassword.bind(authController)
)

// Cambiar contraseña (protegida)
authRoutes.post(
  '/change-password',
  auth,
  AuthController.changePasswordValidations,
  validationHandler,
  authController.changePassword.bind(authController)
)

// Obtener perfil actual (protegida)
authRoutes.get(
  '/profile',
  auth,
  authController.getProfile.bind(authController)
)

// Actualizar perfil (protegida)
authRoutes.put(
  '/profile',
  auth,
  UserController.updateProfileValidations,
  validationHandler,
  authController.updateProfile.bind(authController)
)

// ========================================
// RUTAS DE USUARIOS
// ========================================
const userRoutes = express.Router()

// Obtener perfil de usuario por username
userRoutes.get(
  '/profile/:username',
  userController.getUserProfile.bind(userController)
)

// Seguir/Dejar de seguir usuario (protegida)
userRoutes.post(
  '/:userId/follow',
  auth,
  UserController.followValidations,
  validationHandler,
  userController.toggleFollow.bind(userController)
)

// Buscar usuarios (protegida)
userRoutes.post(
  '/search',
  auth,
  UserController.searchValidations,
  validationHandler,
  userController.searchUsers.bind(userController)
)

// Obtener seguidores de un usuario
userRoutes.get(
  '/:userId/followers',
  userController.getFollowers.bind(userController)
)

// Obtener usuarios seguidos
userRoutes.get(
  '/:userId/following',
  userController.getFollowing.bind(userController)
)

// Eliminar cuenta (protegida)
userRoutes.delete(
  '/account',
  auth,
  userController.deleteAccount.bind(userController)
)

// ========================================
// RUTAS DE POSTS
// ========================================
const postRoutes = express.Router()

// Crear post (protegida)
postRoutes.post(
  '/',
  auth,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'video', maxCount: 1 }
  ]),
  PostController.createPostValidations,
  validationHandler,
  postController.createPost.bind(postController)
)

// Obtener feed (protegida)
postRoutes.get(
  '/feed',
  auth,
  postController.getFeed.bind(postController)
)

// Obtener post por ID
postRoutes.get(
  '/:id',
  postController.getPostById.bind(postController)
)

// Actualizar post (protegida)
postRoutes.put(
  '/:id',
  auth,
  PostController.updatePostValidations,
  validationHandler,
  postController.updatePost.bind(postController)
)

// Eliminar post (protegida)
postRoutes.delete(
  '/:id',
  auth,
  postController.deletePost.bind(postController)
)

// Like/Unlike post (protegida)
postRoutes.post(
  '/:id/like',
  auth,
  postController.toggleLike.bind(postController)
)

// Obtener posts de un usuario
postRoutes.get(
  '/user/:userId',
  postController.getUserPosts.bind(postController)
)

// ========================================
// RUTAS DE COMENTARIOS
// ========================================
const commentRoutes = express.Router()

// Crear comentario (protegida)
commentRoutes.post(
  '/posts/:postId',
  auth,
  CommentController.createCommentValidations,
  validationHandler,
  commentController.createComment.bind(commentController)
)

// Obtener comentarios de un post
commentRoutes.get(
  '/posts/:postId',
  commentController.getComments.bind(commentController)
)

// Obtener respuestas de un comentario
commentRoutes.get(
  '/:commentId/replies',
  commentController.getCommentReplies.bind(commentController)
)

// Actualizar comentario (protegida)
commentRoutes.put(
  '/:commentId',
  auth,
  CommentController.updateCommentValidations,
  validationHandler,
  commentController.updateComment.bind(commentController)
)

// Eliminar comentario (protegida)
commentRoutes.delete(
  '/:commentId',
  auth,
  commentController.deleteComment.bind(commentController)
)

// Like/Unlike comentario (protegida)
commentRoutes.post(
  '/:commentId/like',
  auth,
  commentController.toggleLike.bind(commentController)
)

// ========================================
// RUTAS DE HISTORIAS
// ========================================
const storyRoutes = express.Router()

// Crear historia (protegida)
storyRoutes.post(
  '/',
  auth,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  StoryController.createStoryValidations,
  validationHandler,
  storyController.createStory.bind(storyController)
)

// Obtener historias de un usuario
storyRoutes.get(
  '/user/:username',
  auth,
  storyController.getUserStories.bind(storyController)
)

// Obtener feed de historias
storyRoutes.get(
  '/feed',
  auth,
  storyController.getStoriesFeed.bind(storyController)
)

// Ver historia específica
storyRoutes.get(
  '/:storyId',
  auth,
  storyController.viewStory.bind(storyController)
)

// Eliminar historia
storyRoutes.delete(
  '/:storyId',
  auth,
  storyController.deleteStory.bind(storyController)
)

// Obtener estadísticas de historia
storyRoutes.get(
  '/:storyId/stats',
  auth,
  storyController.getStoryStats.bind(storyController)
)

// ========================================
// RUTAS DE CONVERSACIONES
// ========================================
const conversationRoutes = express.Router()

// Obtener conversaciones del usuario
conversationRoutes.get(
  '/',
  auth,
  conversationController.getConversations.bind(conversationController)
)

// Obtener conversación específica
conversationRoutes.get(
  '/:conversationId',
  auth,
  conversationController.getConversation.bind(conversationController)
)

// Crear conversación directa
conversationRoutes.post(
  '/direct',
  auth,
  ConversationController.createDirectConversationValidations,
  validationHandler,
  conversationController.createDirectConversation.bind(conversationController)
)

// Crear conversación grupal
conversationRoutes.post(
  '/group',
  auth,
  ConversationController.createGroupConversationValidations,
  validationHandler,
  conversationController.createGroupConversation.bind(conversationController)
)

// Agregar participante a conversación grupal
conversationRoutes.post(
  '/:conversationId/participants',
  auth,
  conversationController.addParticipant.bind(conversationController)
)

// Remover participante de conversación grupal
conversationRoutes.delete(
  '/:conversationId/participants/:participantId',
  auth,
  conversationController.removeParticipant.bind(conversationController)
)

// Eliminar conversación
conversationRoutes.delete(
  '/:conversationId',
  auth,
  conversationController.deleteConversation.bind(conversationController)
)

// Obtener estadísticas de conversación
conversationRoutes.get(
  '/:conversationId/stats',
  auth,
  conversationController.getConversationStats.bind(conversationController)
)

// ========================================
// RUTAS DE MENSAJES
// ========================================
const messageRoutes = express.Router()

// Obtener mensajes de una conversación
messageRoutes.get(
  '/conversation/:conversationId',
  auth,
  messageController.getMessages.bind(messageController)
)

// Enviar mensaje de texto
messageRoutes.post(
  '/conversation/:conversationId/text',
  auth,
  MessageController.sendMessageValidations,
  validationHandler,
  messageController.sendTextMessage.bind(messageController)
)

// Enviar mensaje con imagen
messageRoutes.post(
  '/conversation/:conversationId/image',
  auth,
  upload.single('image'),
  messageController.sendImageMessage.bind(messageController)
)

// Editar mensaje
messageRoutes.put(
  '/:messageId',
  auth,
  MessageController.sendMessageValidations,
  validationHandler,
  messageController.editMessage.bind(messageController)
)

// Eliminar mensaje
messageRoutes.delete(
  '/:messageId',
  auth,
  messageController.deleteMessage.bind(messageController)
)

// Buscar mensajes
messageRoutes.get(
  '/conversation/:conversationId/search',
  auth,
  messageController.searchMessages.bind(messageController)
)

// Obtener estadísticas de mensajes
messageRoutes.get(
  '/conversation/:conversationId/stats',
  auth,
  messageController.getMessageStats.bind(messageController)
)

// ========================================
// RUTAS DE NOTIFICACIONES
// ========================================
const notificationRoutes = express.Router()

// Obtener notificaciones del usuario
notificationRoutes.get(
  '/',
  auth,
  notificationController.getNotifications.bind(notificationController)
)

// Obtener conteo de notificaciones no leídas
notificationRoutes.get(
  '/unread-count',
  auth,
  notificationController.getUnreadCount.bind(notificationController)
)

// Marcar notificación como leída
notificationRoutes.put(
  '/:notificationId/read',
  auth,
  notificationController.markAsRead.bind(notificationController)
)

// Marcar múltiples notificaciones como leídas
notificationRoutes.put(
  '/mark-multiple-read',
  auth,
  NotificationController.markAsReadValidations,
  validationHandler,
  notificationController.markMultipleAsRead.bind(notificationController)
)

// Marcar todas las notificaciones como leídas
notificationRoutes.put(
  '/mark-all-read',
  auth,
  notificationController.markAllAsRead.bind(notificationController)
)

// Eliminar notificación
notificationRoutes.delete(
  '/:notificationId',
  auth,
  notificationController.deleteNotification.bind(notificationController)
)

// Eliminar múltiples notificaciones
notificationRoutes.delete(
  '/delete-multiple',
  auth,
  notificationController.deleteMultipleNotifications.bind(notificationController)
)

// Eliminar todas las notificaciones
notificationRoutes.delete(
  '/delete-all',
  auth,
  notificationController.deleteAllNotifications.bind(notificationController)
)

// Obtener notificaciones por tipo
notificationRoutes.get(
  '/type/:type',
  auth,
  notificationController.getNotificationsByType.bind(notificationController)
)

// Obtener estadísticas de notificaciones
notificationRoutes.get(
  '/stats',
  auth,
  notificationController.getNotificationStats.bind(notificationController)
)

// ========================================
// RUTAS DE REELS
// ========================================
const reelRoutes = express.Router()

// Crear reel
reelRoutes.post(
  '/',
  auth,
  upload.fields([
    { name: 'video', maxCount: 1 }
  ]),
  RefactoredReelController.createReelValidations,
  validationHandler,
  reelController.createReel.bind(reelController)
)

// Obtener reel específico
reelRoutes.get(
  '/:id',
  auth,
  RefactoredReelController.getReelValidations,
  validationHandler,
  reelController.getReel.bind(reelController)
)

// Actualizar reel
reelRoutes.put(
  '/:id',
  auth,
  RefactoredReelController.updateReelValidations,
  validationHandler,
  reelController.updateReel.bind(reelController)
)

// Eliminar reel
reelRoutes.delete(
  '/:id',
  auth,
  RefactoredReelController.deleteReelValidations,
  validationHandler,
  reelController.deleteReel.bind(reelController)
)

// Like/Unlike reel
reelRoutes.post(
  '/:id/like',
  auth,
  RefactoredReelController.likeReelValidations,
  validationHandler,
  reelController.likeReel.bind(reelController)
)

// Obtener feed de reels
reelRoutes.get(
  '/',
  auth,
  RefactoredReelController.getReelsFeedValidations,
  validationHandler,
  reelController.getReelsFeed.bind(reelController)
)

// Obtener reels de usuario
reelRoutes.get(
  '/user/:userId',
  auth,
  RefactoredReelController.getUserReelsValidations,
  validationHandler,
  reelController.getUserReels.bind(reelController)
)

// Buscar reels
reelRoutes.get(
  '/search',
  auth,
  RefactoredReelController.searchReelsValidations,
  validationHandler,
  reelController.searchReels.bind(reelController)
)

// Obtener reels trending
reelRoutes.get(
  '/trending',
  auth,
  reelController.getTrendingReels.bind(reelController)
)

// Obtener estadísticas de reel
reelRoutes.get(
  '/:id/stats',
  auth,
  reelController.getReelStats.bind(reelController)
)

// ========================================
// RUTAS DE LIVE STREAMS
// ========================================
const liveStreamRoutes = express.Router()

// Crear live stream
liveStreamRoutes.post(
  '/',
  auth,
  RefactoredLiveStreamController.createLiveStreamValidations,
  validationHandler,
  liveStreamController.createLiveStream.bind(liveStreamController)
)

// Obtener live stream específico
liveStreamRoutes.get(
  '/:id',
  auth,
  RefactoredLiveStreamController.getLiveStreamValidations,
  validationHandler,
  liveStreamController.getLiveStream.bind(liveStreamController)
)

// Actualizar live stream
liveStreamRoutes.put(
  '/:id',
  auth,
  RefactoredLiveStreamController.updateLiveStreamValidations,
  validationHandler,
  liveStreamController.updateLiveStream.bind(liveStreamController)
)

// Iniciar live stream
liveStreamRoutes.post(
  '/:id/start',
  auth,
  liveStreamController.startLiveStream.bind(liveStreamController)
)

// Terminar live stream
liveStreamRoutes.post(
  '/:id/end',
  auth,
  RefactoredLiveStreamController.endLiveStreamValidations,
  validationHandler,
  liveStreamController.endLiveStream.bind(liveStreamController)
)

// Unirse a live stream
liveStreamRoutes.post(
  '/:id/join',
  auth,
  RefactoredLiveStreamController.joinLiveStreamValidations,
  validationHandler,
  liveStreamController.joinLiveStream.bind(liveStreamController)
)

// Salir de live stream
liveStreamRoutes.post(
  '/:id/leave',
  auth,
  RefactoredLiveStreamController.leaveLiveStreamValidations,
  validationHandler,
  liveStreamController.leaveLiveStream.bind(liveStreamController)
)

// Obtener live streams activos
liveStreamRoutes.get(
  '/',
  auth,
  RefactoredLiveStreamController.getLiveStreamsValidations,
  validationHandler,
  liveStreamController.getLiveStreams.bind(liveStreamController)
)

// Obtener live streams de usuario
liveStreamRoutes.get(
  '/user/:userId',
  auth,
  RefactoredLiveStreamController.getUserLiveStreamsValidations,
  validationHandler,
  liveStreamController.getUserLiveStreams.bind(liveStreamController)
)

// Obtener estadísticas de live stream
liveStreamRoutes.get(
  '/:id/stats',
  auth,
  liveStreamController.getLiveStreamStats.bind(liveStreamController)
)

// ========================================
// RUTAS DE ANALYTICS
// ========================================
const analyticsRoutes = express.Router()

// Registrar evento de analytics
analyticsRoutes.post(
  '/event',
  RefactoredAnalyticsController.trackEventValidations,
  validationHandler,
  analyticsController.trackEvent.bind(analyticsController)
)

// Obtener eventos de analytics
analyticsRoutes.get(
  '/events',
  auth,
  RefactoredAnalyticsController.getEventsValidations,
  validationHandler,
  analyticsController.getEvents.bind(analyticsController)
)

// Obtener analytics de usuario
analyticsRoutes.get(
  '/user/:userId',
  auth,
  RefactoredAnalyticsController.getUserAnalyticsValidations,
  validationHandler,
  analyticsController.getUserAnalytics.bind(analyticsController)
)

// Obtener analytics de contenido
analyticsRoutes.get(
  '/content',
  auth,
  RefactoredAnalyticsController.getContentAnalyticsValidations,
  validationHandler,
  analyticsController.getContentAnalytics.bind(analyticsController)
)

// Obtener métricas de la plataforma
analyticsRoutes.get(
  '/platform',
  auth,
  analyticsController.getPlatformMetrics.bind(analyticsController)
)

// Obtener eventos más frecuentes
analyticsRoutes.get(
  '/top-events',
  auth,
  analyticsController.getTopEvents.bind(analyticsController)
)

// ========================================
// CONFIGURAR RUTAS PRINCIPALES
// ========================================

// Rutas de autenticación
router.use('/auth', authRoutes)

// Rutas de usuarios
router.use('/users', userRoutes)

// Rutas de posts
router.use('/posts', postRoutes)

// Rutas de comentarios
router.use('/comments', commentRoutes)

// Rutas de historias
router.use('/stories', storyRoutes)

// Rutas de conversaciones
router.use('/conversations', conversationRoutes)

// Rutas de mensajes
router.use('/messages', messageRoutes)

// Rutas de notificaciones
router.use('/notifications', notificationRoutes)

// Rutas de reels
router.use('/reels', reelRoutes)

// Rutas de live streams
router.use('/live', liveStreamRoutes)

// Rutas de analytics
router.use('/analytics', analyticsRoutes)

export default router
