import type { ConversationRepository } from '../repositories/conversation.repository.js';
import { MongoConversationRepository } from '../repositories/conversation.repository.js';
import type { MessageRepository } from '../repositories/message.repository.js';
import { MongoMessageRepository } from '../repositories/message.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import { getSocketServer } from '@interfaces/ws/socket-server.js';

export interface ConversationWithUser {
  id: string;
  otherUser: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
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
   * Obtiene todas las conversaciones del usuario con información del otro participante.
   */
  public async getConversations(userId: string): Promise<ConversationWithUser[]> {
    const conversationEntities = await this.conversations.findByUserId(userId);

    const result: ConversationWithUser[] = [];

    for (const conv of conversationEntities) {
      const otherUserId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;
      const otherUser = await this.users.findById(otherUserId);

      if (!otherUser) {
        continue;
      }

      // Obtener último mensaje
      const messagesResult = await this.messages.findByConversationId({
        conversationId: conv.id,
        limit: 1
      });

      const unreadCount = conv.participant1Id === userId ? conv.unreadCount1 : conv.unreadCount2;

      result.push({
        id: conv.id,
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
        updatedAt: conv.lastMessageAt?.toISOString() ?? conv.updatedAt.toISOString()
      });
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
    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
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
    if (conversation.participant1Id !== senderId && conversation.participant2Id !== senderId) {
      throw new Error('No puedes enviar mensajes a esta conversación');
    }

    const message = await this.messages.create({
      conversationId,
      senderId,
      content
    });

    const now = new Date();
    await this.conversations.updateLastMessage(conversationId, now);

    // Incrementar contador de no leídos para el otro participante
    const recipientId = conversation.participant1Id === senderId ? conversation.participant2Id : conversation.participant1Id;
    await this.conversations.incrementUnread(conversationId, recipientId);

    const sender = await this.users.findById(senderId);

    // Emitir mensaje en tiempo real vía WebSocket
    try {
      const io = getSocketServer();
      io.to(`user:${recipientId}`).emit('new-message', {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt.toISOString()
      });

      // También emitir al remitente para confirmación
      io.to(`user:${senderId}`).emit('message-sent', {
        id: message.id,
        conversationId: message.conversationId,
        createdAt: message.createdAt.toISOString()
      });
    } catch (error) {
      console.error('Error al emitir mensaje vía WebSocket:', error);
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
}

