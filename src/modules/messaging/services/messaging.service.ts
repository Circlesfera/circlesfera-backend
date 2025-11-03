import type { ConversationRepository } from '../repositories/conversation.repository.js';
import { MongoConversationRepository } from '../repositories/conversation.repository.js';
import type { MessageRepository } from '../repositories/message.repository.js';
import { MongoMessageRepository } from '../repositories/message.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import { getSocketServer } from '@interfaces/ws/socket-server.js';
import { logger } from '@infra/logger/logger.js';

export interface ConversationWithUser {
  id: string;
  type: 'direct' | 'group';
  otherUser?: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  groupName?: string;
  participants?: Array<{
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
  }>;
  createdBy?: string;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageWithSender {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  content: string;
  isRead: boolean;
  createdAt: string;
}

export class MessagingService {
  public constructor(
    private readonly conversations: ConversationRepository = new MongoConversationRepository(),
    private readonly messages: MessageRepository = new MongoMessageRepository(),
    private readonly users: UserRepository = new MongoUserRepository()
  ) {}

  /**
   * Obtiene todas las conversaciones del usuario con información del otro participante o grupo.
   */
  public async getConversations(userId: string): Promise<ConversationWithUser[]> {
    const conversationEntities = await this.conversations.findByUserId(userId);

    const result: ConversationWithUser[] = [];

    for (const conv of conversationEntities) {
      // Obtener último mensaje
      const messagesResult = await this.messages.findByConversationId({
        conversationId: conv.id,
        limit: 1
      });

      if (conv.type === 'group') {
        // Para grupos
        const participantIds = conv.participants || [];
        const participants = await this.users.findManyByIds(participantIds);

        const unreadCount = conv.unreadCounts?.[userId] || 0;

        result.push({
          id: conv.id,
          type: 'group',
          groupName: conv.groupName,
          participants: participants.map((p) => ({
            id: p.id,
            handle: p.handle,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl ?? ''
          })),
          createdBy: conv.createdBy,
          lastMessage:
            messagesResult.items.length > 0
              ? {
                  id: messagesResult.items[0].id,
                  content: messagesResult.items[0].content,
                  senderId: messagesResult.items[0].senderId,
                  createdAt: messagesResult.items[0].createdAt.toISOString()
                }
              : undefined,
          unreadCount,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.lastMessageAt?.toISOString() ?? conv.updatedAt.toISOString()
        });
      } else {
        // Para conversaciones directas
        const otherUserId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;
        if (!otherUserId) {
          continue;
        }

        const otherUser = await this.users.findById(otherUserId);
        if (!otherUser) {
          continue;
        }

        const unreadCount = conv.participant1Id === userId ? conv.unreadCount1 : conv.unreadCount2;

        result.push({
          id: conv.id,
          type: 'direct',
          otherUser: {
            id: otherUser.id,
            handle: otherUser.handle,
            displayName: otherUser.displayName,
            avatarUrl: otherUser.avatarUrl ?? ''
          },
          lastMessage:
            messagesResult.items.length > 0
              ? {
                  id: messagesResult.items[0].id,
                  content: messagesResult.items[0].content,
                  senderId: messagesResult.items[0].senderId,
                  createdAt: messagesResult.items[0].createdAt.toISOString()
                }
              : undefined,
          unreadCount,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.lastMessageAt?.toISOString() ?? conv.updatedAt.toISOString()
        });
      }
    }

    // Ordenar por fecha del último mensaje
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Crea o encuentra una conversación entre dos usuarios.
   */
  public async findOrCreateConversation(userId1: string, userId2: string): Promise<string> {
    const conversation = await this.conversations.findOrCreate({
      participant1Id: userId1,
      participant2Id: userId2
    });

    return conversation.id;
  }

  /**
   * Obtiene los mensajes de una conversación.
   */
  public async getMessages(conversationId: string, userId: string, limit = 50, cursor?: Date): Promise<{
    messages: MessageWithSender[];
    nextCursor: string | null;
  }> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    // Verificar que el usuario es participante
    const isParticipant =
      conversation.type === 'group'
        ? conversation.participants?.includes(userId)
        : conversation.participant1Id === userId || conversation.participant2Id === userId;

    if (!isParticipant) {
      throw new Error('No tienes acceso a esta conversación');
    }

    const result = await this.messages.findByConversationId({
      conversationId,
      limit,
      cursor
    });

    // Obtener información de los remitentes
    const senderIds = Array.from(new Set(result.items.map((msg) => msg.senderId)));
    const senders = await this.users.findManyByIds(senderIds);
    const sendersMap = new Map(senders.map((user) => [user.id, user]));

    const messages: MessageWithSender[] = result.items.map((msg) => {
      const sender = sendersMap.get(msg.senderId);
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        sender: sender
          ? {
              id: sender.id,
              handle: sender.handle,
              displayName: sender.displayName,
              avatarUrl: sender.avatarUrl ?? ''
            }
          : {
              id: msg.senderId,
              handle: 'usuario',
              displayName: 'Usuario desconocido',
              avatarUrl: ''
            },
        content: msg.content,
        isRead: msg.isRead,
        createdAt: msg.createdAt.toISOString()
      };
    });

    const lastMessage = result.items[result.items.length - 1];
    const nextCursor = result.hasMore ? lastMessage.createdAt.toISOString() : null;

    // Marcar mensajes como leídos
    await this.messages.markConversationAsRead(conversationId, userId);
    await this.conversations.resetUnread(conversationId, userId);

    return { messages, nextCursor };
  }

  /**
   * Envía un mensaje y actualiza la conversación.
   */
  public async sendMessage(conversationId: string, senderId: string, content: string): Promise<MessageWithSender> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    // Verificar que el remitente es participante
    const isParticipant =
      conversation.type === 'group'
        ? conversation.participants?.includes(senderId)
        : conversation.participant1Id === senderId || conversation.participant2Id === senderId;

    if (!isParticipant) {
      throw new Error('No puedes enviar mensajes a esta conversación');
    }

    const message = await this.messages.create({
      conversationId,
      senderId,
      content
    });

    const now = new Date();
    await this.conversations.updateLastMessage(conversationId, now);

    // Incrementar contador de no leídos para otros participantes
    if (conversation.type === 'group') {
      const participants = conversation.participants || [];
      for (const participantId of participants) {
        if (participantId !== senderId) {
          await this.conversations.incrementUnread(conversationId, participantId);
        }
      }
    } else {
      const recipientId = conversation.participant1Id === senderId ? conversation.participant2Id : conversation.participant1Id;
      if (recipientId) {
        await this.conversations.incrementUnread(conversationId, recipientId);
      }
    }

    const sender = await this.users.findById(senderId);

    // Emitir mensaje en tiempo real vía WebSocket
    try {
      const io = getSocketServer();

      if (conversation.type === 'group') {
        // Para grupos, emitir a todos los participantes excepto al remitente
        const participants = conversation.participants || [];
        for (const participantId of participants) {
          if (participantId !== senderId) {
            io.to(`user:${participantId}`).emit('new-message', {
              id: message.id,
              conversationId: message.conversationId,
              senderId: message.senderId,
              content: message.content,
              createdAt: message.createdAt.toISOString()
            });
          }
        }
      } else {
        // Para conversaciones directas
        const recipientId = conversation.participant1Id === senderId ? conversation.participant2Id : conversation.participant1Id;
        if (recipientId) {
          io.to(`user:${recipientId}`).emit('new-message', {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt.toISOString()
          });
        }
      }

      // También emitir al remitente para confirmación
      io.to(`user:${senderId}`).emit('message-sent', {
        id: message.id,
        conversationId: message.conversationId,
        createdAt: message.createdAt.toISOString()
      });
    } catch (error) {
      logger.warn({ err: error, messageId: message.id, conversationId: message.conversationId }, 'Error al emitir mensaje vía WebSocket');
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: sender
        ? {
            id: sender.id,
            handle: sender.handle,
            displayName: sender.displayName,
            avatarUrl: sender.avatarUrl ?? ''
          }
        : {
            id: senderId,
            handle: 'usuario',
            displayName: 'Usuario desconocido',
            avatarUrl: ''
          },
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt.toISOString()
    };
  }

  /**
   * Crea un nuevo grupo.
   */
  public async createGroup(userId: string, participantIds: string[], groupName: string): Promise<string> {
    // Asegurar que el creador esté en la lista de participantes
    const allParticipants = Array.from(new Set([userId, ...participantIds]));
    
    if (allParticipants.length < 2) {
      throw new Error('Un grupo debe tener al menos 2 participantes');
    }

    const conversation = await this.conversations.createGroup({
      participants: allParticipants,
      groupName,
      createdBy: userId
    });

    // Emitir evento de creación de grupo a todos los participantes
    const io = getSocketServer();
    const participantUsers = await this.users.findManyByIds(allParticipants);
    
    for (const participantId of allParticipants) {
      io.to(`user:${participantId}`).emit('group-created', {
        conversationId: conversation.id,
        groupName: conversation.groupName,
        participants: participantUsers.map(u => ({
          id: u.id,
          handle: u.handle,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl
        }))
      });
    }

    return conversation.id;
  }

  /**
   * Agrega un participante a un grupo.
   */
  public async addParticipant(conversationId: string, userId: string, newParticipantId: string): Promise<void> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (conversation.type !== 'group') {
      throw new Error('Solo se pueden agregar participantes a grupos');
    }

    // Verificar que el usuario que hace la acción es participante
    const isParticipant = conversation.participants?.includes(userId);
    if (!isParticipant) {
      throw new Error('No tienes permiso para agregar participantes');
    }

    await this.conversations.addParticipant(conversationId, newParticipantId);

    // Obtener info del nuevo participante y emitir evento
    const newParticipant = await this.users.findById(newParticipantId);
    const updatedConversation = await this.conversations.findById(conversationId);
    
    if (updatedConversation && newParticipant) {
      const io = getSocketServer();
      const participants = updatedConversation.participants || [];
      
      // Emitir a todos los participantes del grupo
      for (const participantId of participants) {
        io.to(`user:${participantId}`).emit('group-updated', {
          conversationId,
          type: 'participant-added',
          participant: {
            id: newParticipant.id,
            handle: newParticipant.handle,
            displayName: newParticipant.displayName,
            avatarUrl: newParticipant.avatarUrl
          }
        });
      }
    }
  }

  /**
   * Quita un participante de un grupo.
   */
  public async removeParticipant(conversationId: string, userId: string, participantToRemove: string): Promise<void> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (conversation.type !== 'group') {
      throw new Error('Esta operación solo aplica a grupos');
    }

    // Verificar que el usuario que hace la acción es participante
    const isParticipant = conversation.participants?.includes(userId);
    if (!isParticipant) {
      throw new Error('No tienes permiso para quitar participantes');
    }

    // Permitir que un usuario se quite a sí mismo, o que el creador quite a otros
    if (participantToRemove !== userId && conversation.createdBy !== userId) {
      throw new Error('Solo el creador puede quitar a otros participantes');
    }

    await this.conversations.removeParticipant(conversationId, participantToRemove);

    // Emitir evento de actualización
    const updatedConversation = await this.conversations.findById(conversationId);
    if (updatedConversation) {
      const io = getSocketServer();
      const participants = updatedConversation.participants || [];
      
      // Emitir a todos los participantes restantes del grupo
      for (const participantId of participants) {
        io.to(`user:${participantId}`).emit('group-updated', {
          conversationId,
          type: 'participant-removed',
          participantId: participantToRemove
        });
      }
      
      // Si el usuario se quitó a sí mismo, también notificarlo
      if (participantToRemove !== userId) {
        io.to(`user:${participantToRemove}`).emit('group-updated', {
          conversationId,
          type: 'removed-from-group'
        });
      }
    }
  }

  /**
   * Actualiza el nombre de un grupo.
   */
  public async updateGroupName(conversationId: string, userId: string, groupName: string): Promise<void> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (conversation.type !== 'group') {
      throw new Error('Solo los grupos tienen nombre');
    }

    // Verificar que el usuario es participante
    const isParticipant = conversation.participants?.includes(userId);
    if (!isParticipant) {
      throw new Error('No tienes permiso para cambiar el nombre del grupo');
    }

    await this.conversations.updateGroupName(conversationId, groupName);

    // Emitir evento de actualización
    const updatedConversation = await this.conversations.findById(conversationId);
    if (updatedConversation) {
      const io = getSocketServer();
      const participants = updatedConversation.participants || [];
      
      // Emitir a todos los participantes del grupo
      for (const participantId of participants) {
        io.to(`user:${participantId}`).emit('group-updated', {
          conversationId,
          type: 'name-changed',
          groupName: updatedConversation.groupName
        });
      }
    }
  }
}

