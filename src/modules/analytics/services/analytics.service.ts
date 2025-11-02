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

    // Obtener estadísticas básicas del perfil
    const [totalFollowers, totalFollowing] = await Promise.all([
      this.follows.countFollowers(userId),
      this.follows.countFollowing(userId)
    ]);

    // Calcular métricas agregadas
    const totalLikes = allPosts.reduce((sum, post) => sum + post.stats.likes, 0);
    const totalComments = allPosts.reduce((sum, post) => sum + post.stats.comments, 0);
    const totalSaves = allPosts.reduce((sum, post) => sum + post.stats.saves, 0);
    const totalShares = allPosts.reduce((sum, post) => sum + post.stats.shares, 0);
    const totalViews = allPosts.reduce((sum, post) => sum + post.stats.views, 0);

    // Calcular engagement rate promedio
    const engagementRates = allPosts
      .filter((post) => post.stats.views > 0)
      .map((post) => {
        const engagement = post.stats.likes + post.stats.comments + post.stats.saves;
        return (engagement / post.stats.views) * 100;
      });

    const averageEngagementRate =
      engagementRates.length > 0
        ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length
        : 0;

    const averageViewsPerPost = allPosts.length > 0 ? totalViews / allPosts.length : 0;

    // Posts recientes (últimos N)
    const recentPosts = allPosts
      .slice(0, limit)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((post) => this.mapPostToAnalytics(post));

    // Top posts por engagement
    const topPosts = allPosts
      .map((post) => {
        const engagement = post.stats.likes + post.stats.comments + post.stats.saves;
        return { post, engagement };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit)
      .map(({ post }) => this.mapPostToAnalytics(post));

    // Calcular tendencias de crecimiento (simulado: basado en posts recientes vs antiguos)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPostsCount = allPosts.filter((post) => post.createdAt >= thirtyDaysAgo).length;

    // Determinar tendencia de engagement comparando posts recientes vs antiguos
    const recentEngagement = recentPosts
      .slice(0, 5)
      .reduce((sum, p) => sum + p.metrics.engagementRate, 0) / Math.max(recentPosts.slice(0, 5).length, 1);
    const olderPosts = allPosts
      .slice(limit, limit + 5)
      .map((post) => {
        const engagement = (post.stats?.likes ?? 0) + (post.stats?.comments ?? 0) + (post.stats?.saves ?? 0);
        const rate = (engagement / Math.max(post.stats?.views ?? 1, 1)) * 100;
        return rate;
      });
    const olderEngagement = olderPosts.length > 0 ? olderPosts.reduce((sum, r) => sum + r, 0) / olderPosts.length : 0;

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
   * Obtiene analytics de un post individual.
   */
  public async getPostAnalytics(postId: string): Promise<PostAnalytics | null> {
    const post = await this.posts.findById(postId);
    if (!post) {
      return null;
    }

    return this.mapPostToAnalytics(post);
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
}

