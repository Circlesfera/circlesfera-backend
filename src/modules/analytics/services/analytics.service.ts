import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { FollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import { MongoFollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import type { LikeRepository } from '@modules/interactions/repositories/like.repository.js';
import { MongoLikeRepository } from '@modules/interactions/repositories/like.repository.js';
import type { CommentRepository } from '@modules/interactions/repositories/comment.repository.js';
import { MongoCommentRepository } from '@modules/interactions/repositories/comment.repository.js';
import type { SaveRepository } from '@modules/interactions/repositories/save.repository.js';
import { MongoSaveRepository } from '@modules/interactions/repositories/save.repository.js';
import mongoose from 'mongoose';
import { LikeModel } from '@modules/interactions/models/like.model.js';
import { CommentModel } from '@modules/interactions/models/comment.model.js';
import { SaveModel } from '@modules/interactions/models/save.model.js';

export interface PostAnalytics {
  postId: string;
  createdAt: string;
  caption: string;
  mediaCount: number;
  metrics: {
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    views: number;
    engagementRate: number; // (likes + comments + saves) / views * 100
    reach: number; // Aproximación: views
  };
  topPerformers?: {
    bestDay?: string;
    bestTime?: string;
  };
}

export interface ProfileAnalytics {
  overview: {
    totalPosts: number;
    totalFollowers: number;
    totalFollowing: number;
    totalLikes: number;
    totalComments: number;
    totalSaves: number;
    totalShares: number;
    totalViews: number;
    averageEngagementRate: number;
    averageViewsPerPost: number;
  };
  recentPosts: PostAnalytics[];
  topPosts: PostAnalytics[];
  growth: {
    followersGrowth: number; // Cambio en últimos 30 días (simulado por ahora)
    postsGrowth: number; // Posts creados en últimos 30 días
    engagementTrend: 'up' | 'down' | 'stable'; // Tendencia basada en últimos posts
  };
  engagementByType: {
    likes: number;
    comments: number;
    saves: number;
    shares: number;
  };
}

export class AnalyticsService {
  public constructor(
    private readonly posts: PostRepository = new MongoPostRepository(),
    private readonly follows: FollowRepository = new MongoFollowRepository(),
    private readonly likes: LikeRepository = new MongoLikeRepository(),
    private readonly comments: CommentRepository = new MongoCommentRepository(),
    private readonly saves: SaveRepository = new MongoSaveRepository()
  ) {}

  /**
   * Obtiene analytics detallados del perfil de un usuario.
   */
  public async getProfileAnalytics(userId: string, limit = 10): Promise<ProfileAnalytics> {
    // Obtener todos los posts del usuario
    const { items: allPosts } = await this.posts.findByAuthorId({
      authorId: userId,
      limit: 1000, // Obtener muchos para cálculos
      cursor: undefined
    });

    const postIds = allPosts.map((post) => post.id);

    // Obtener estadísticas básicas del perfil
    const [totalFollowers, totalFollowing] = await Promise.all([
      this.follows.countFollowers(userId),
      this.follows.countFollowing(userId)
    ]);

    // Contar directamente desde las colecciones para evitar desincronización
    // Usar agregaciones para contar likes/comments/saves de todos los posts del usuario
    const [totalLikes, totalComments, totalSaves] = await Promise.all([
      postIds.length > 0
        ? this.countLikesByPostIds(postIds)
        : Promise.resolve(0),
      postIds.length > 0
        ? this.countCommentsByPostIds(postIds)
        : Promise.resolve(0),
      postIds.length > 0
        ? this.countSavesByPostIds(postIds)
        : Promise.resolve(0)
    ]);

    // Para shares y views, usar los contadores del post (no hay colección separada aún)
    const totalShares = allPosts.reduce((sum, post) => sum + post.stats.shares, 0);
    const totalViews = allPosts.reduce((sum, post) => sum + post.stats.views, 0);

    // Calcular engagement rate promedio usando contadores reales
    const engagementRatesPromises = allPosts
      .filter((post) => post.stats.views > 0)
      .map(async (post) => {
        const [realLikes, realComments, realSaves] = await Promise.all([
          this.likes.countByPostId(post.id),
          this.comments.countByPostId(post.id),
          SaveModel.countDocuments({ postId: new mongoose.Types.ObjectId(post.id) }).exec()
        ]);
        const engagement = realLikes + realComments + realSaves;
        return (engagement / post.stats.views) * 100;
      });

    const engagementRates = await Promise.all(engagementRatesPromises);
    const averageEngagementRate =
      engagementRates.length > 0
        ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length
        : 0;

    const averageViewsPerPost = allPosts.length > 0 ? totalViews / allPosts.length : 0;

    // Posts recientes (últimos N) - usar contadores reales
    const sortedRecentPosts = allPosts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    const recentPosts = await Promise.all(
      sortedRecentPosts.map(async (post) => {
        const [realLikes, realComments, realSaves] = await Promise.all([
          this.likes.countByPostId(post.id),
          this.comments.countByPostId(post.id),
          SaveModel.countDocuments({ postId: new mongoose.Types.ObjectId(post.id) }).exec()
        ]);
        return this.mapPostToAnalyticsWithRealCounts(post, realLikes, realComments, realSaves);
      })
    );

    // Top posts por engagement - usar contadores reales
    const postsWithRealCounts = await Promise.all(
      allPosts.map(async (post) => {
        const [realLikes, realComments, realSaves] = await Promise.all([
          this.likes.countByPostId(post.id),
          this.comments.countByPostId(post.id),
          SaveModel.countDocuments({ postId: new mongoose.Types.ObjectId(post.id) }).exec()
        ]);
        const engagement = realLikes + realComments + realSaves;
        return { post, engagement, realLikes, realComments, realSaves };
      })
    );
    
    const topPosts = postsWithRealCounts
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit)
      .map(({ post, realLikes, realComments, realSaves }) => 
        this.mapPostToAnalyticsWithRealCounts(post, realLikes, realComments, realSaves)
      );

    // Calcular tendencias de crecimiento (simulado: basado en posts recientes vs antiguos)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPostsCount = allPosts.filter((post) => post.createdAt >= thirtyDaysAgo).length;

    // Determinar tendencia de engagement comparando posts recientes vs antiguos
    // Usar los datos reales de recentPosts que ya tienen contadores reales
    const recentEngagement = recentPosts.length > 0
      ? recentPosts.slice(0, 5).reduce((sum, p) => sum + p.metrics.engagementRate, 0) / Math.max(recentPosts.slice(0, 5).length, 1)
      : 0;
    
    // Para posts antiguos, calcular engagement rate con contadores reales
    const olderPostsSlice = allPosts.slice(limit, limit + 5);
    const olderPostsEngagementRates = await Promise.all(
      olderPostsSlice.map(async (post) => {
        const [realLikes, realComments, realSaves] = await Promise.all([
          this.likes.countByPostId(post.id),
          this.comments.countByPostId(post.id),
          SaveModel.countDocuments({ postId: new mongoose.Types.ObjectId(post.id) }).exec()
        ]);
        const engagement = realLikes + realComments + realSaves;
        return (engagement / Math.max(post.stats?.views ?? 1, 1)) * 100;
      })
    );
    const olderEngagement = olderPostsEngagementRates.length > 0 
      ? olderPostsEngagementRates.reduce((sum, r) => sum + r, 0) / olderPostsEngagementRates.length 
      : 0;

    let engagementTrend: 'up' | 'down' | 'stable' = 'stable';
    if (recentEngagement > olderEngagement * 1.1) {
      engagementTrend = 'up';
    } else if (recentEngagement < olderEngagement * 0.9) {
      engagementTrend = 'down';
    }

    return {
      overview: {
        totalPosts: allPosts.length,
        totalFollowers,
        totalFollowing,
        totalLikes,
        totalComments,
        totalSaves,
        totalShares,
        totalViews,
        averageEngagementRate: Math.round(averageEngagementRate * 100) / 100,
        averageViewsPerPost: Math.round(averageViewsPerPost * 100) / 100
      },
      recentPosts,
      topPosts,
      growth: {
        followersGrowth: 0, // TODO: Implementar tracking histórico
        postsGrowth: recentPostsCount,
        engagementTrend
      },
      engagementByType: {
        likes: totalLikes,
        comments: totalComments,
        saves: totalSaves,
        shares: totalShares
      }
    };
  }

  /**
   * Obtiene analytics de un post individual usando contadores reales.
   */
  public async getPostAnalytics(postId: string): Promise<PostAnalytics | null> {
    const post = await this.posts.findById(postId);
    if (!post) {
      return null;
    }

    // Obtener contadores reales desde las colecciones
    const [realLikes, realComments, realSaves] = await Promise.all([
      this.likes.countByPostId(postId),
      this.comments.countByPostId(postId),
      SaveModel.countDocuments({ postId: new mongoose.Types.ObjectId(postId) }).exec()
    ]);

    return this.mapPostToAnalyticsWithRealCounts(post, realLikes, realComments, realSaves);
  }

  /**
   * Cuenta el total de likes para una lista de posts.
   */
  private async countLikesByPostIds(postIds: string[]): Promise<number> {
    if (postIds.length === 0) {
      return 0;
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    return await LikeModel.countDocuments({
      postId: { $in: objectIds }
    }).exec();
  }

  /**
   * Cuenta el total de comentarios para una lista de posts.
   */
  private async countCommentsByPostIds(postIds: string[]): Promise<number> {
    if (postIds.length === 0) {
      return 0;
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    return await CommentModel.countDocuments({
      postId: { $in: objectIds }
    }).exec();
  }

  /**
   * Cuenta el total de saves para una lista de posts.
   */
  private async countSavesByPostIds(postIds: string[]): Promise<number> {
    if (postIds.length === 0) {
      return 0;
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    return await SaveModel.countDocuments({
      postId: { $in: objectIds }
    }).exec();
  }

  private mapPostToAnalytics(post: {
    id: string;
    createdAt: Date;
    caption: string;
    media: Array<{ id: string }>;
    stats: { likes: number; comments: number; saves: number; shares: number; views: number };
  }): PostAnalytics {
    const stats = post.stats;
    const engagement = stats.likes + stats.comments + stats.saves;
    const engagementRate = stats.views > 0 ? (engagement / stats.views) * 100 : 0;

    return {
      postId: post.id,
      createdAt: post.createdAt.toISOString(),
      caption: post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : ''),
      mediaCount: post.media.length,
      metrics: {
        likes: stats.likes,
        comments: stats.comments,
        saves: stats.saves,
        shares: stats.shares,
        views: stats.views,
        engagementRate: Math.round(engagementRate * 100) / 100,
        reach: stats.views // Aproximación
      }
    };
  }

  /**
   * Mapea un post a analytics usando contadores reales desde las colecciones.
   */
  private mapPostToAnalyticsWithRealCounts(
    post: {
      id: string;
      createdAt: Date;
      caption: string;
      media: Array<{ id: string }>;
      stats: { likes: number; comments: number; saves: number; shares: number; views: number };
    },
    realLikes?: number,
    realComments?: number,
    realSaves?: number
  ): PostAnalytics {
    const stats = post.stats;
    // Usar contadores reales si están disponibles, sino usar los del post
    const likes = realLikes ?? stats.likes;
    const comments = realComments ?? stats.comments;
    const saves = realSaves ?? stats.saves;
    const engagement = likes + comments + saves;
    const engagementRate = stats.views > 0 ? (engagement / stats.views) * 100 : 0;

    return {
      postId: post.id,
      createdAt: post.createdAt.toISOString(),
      caption: post.caption.substring(0, 100) + (post.caption.length > 100 ? '...' : ''),
      mediaCount: post.media.length,
      metrics: {
        likes,
        comments,
        saves,
        shares: stats.shares,
        views: stats.views,
        engagementRate: Math.round(engagementRate * 100) / 100,
        reach: stats.views // Aproximación
      }
    };
  }
}

