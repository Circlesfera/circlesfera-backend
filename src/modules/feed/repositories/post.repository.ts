import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { PostModel, Post, PostMedia } from '../models/post.model.js';

type PostDocument = DocumentType<Post>;

export interface PostStats {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
}

export interface PostEntity {
  id: string;
  authorId: string;
  caption: string;
  media: PostMedia[];
  hashtags: string[];
  stats: PostStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePostInput {
  authorId: string;
  caption: string;
  media: PostMedia[];
  hashtags?: string[];
}

export interface FeedQueryOptions {
  authorIds: string[];
  limit: number;
  cursor?: Date;
  sortBy?: 'recent' | 'relevance';
}

export interface FeedQueryResult {
  items: PostEntity[];
  hasMore: boolean;
}

export interface ExploreQueryOptions {
  limit?: number;
  cursor?: Date;
  excludeAuthorIds?: string[];
}

export interface HashtagQueryOptions {
  hashtag: string;
  limit?: number;
  cursor?: Date;
}

export interface HashtagsQueryOptions {
  hashtags: string[]; // Array de hashtags normalizados
  limit?: number;
  cursor?: Date;
  excludeAuthorIds?: string[]; // Excluir posts de estos autores
}

const toDomainPost = (doc: DocumentType<Post> | (Post & { _id: mongoose.Types.ObjectId })): PostEntity => {
  const plain = 'toObject' in doc ? doc.toObject<Post & { _id: mongoose.Types.ObjectId }>() : doc;

  return {
    id: plain._id.toString(),
    authorId: plain.authorId.toString(),
    caption: plain.caption,
    media: plain.media,
    hashtags: plain.hashtags ?? [],
    stats: {
      likes: plain.likes,
      comments: plain.comments,
      saves: plain.saves,
      shares: plain.shares,
      views: plain.views
    },
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export interface UserPostsOptions {
  authorId: string;
  limit?: number;
  cursor?: Date;
}

export interface SearchPostsOptions {
  query: string;
  limit?: number;
  cursor?: Date;
}

export interface ReelsQueryOptions {
  limit?: number;
  cursor?: Date;
  excludeAuthorIds?: string[];
}

export interface PostRepository {
  create(data: CreatePostInput): Promise<PostEntity>;
  findFeed(options: FeedQueryOptions): Promise<FeedQueryResult>;
  findByAuthorId(options: UserPostsOptions): Promise<FeedQueryResult>;
  countByAuthorId(authorId: string): Promise<number>;
  incrementLikes(postId: string): Promise<void>;
  decrementLikes(postId: string): Promise<void>;
  incrementComments(postId: string): Promise<void>;
  findById(postId: string): Promise<PostEntity | null>;
  findManyByIds(postIds: string[]): Promise<PostEntity[]>;
  findExplore(options: ExploreQueryOptions): Promise<FeedQueryResult>;
  findByHashtag(options: HashtagQueryOptions): Promise<FeedQueryResult>;
  findByHashtags(options: HashtagsQueryOptions): Promise<FeedQueryResult>;
  searchPosts(options: SearchPostsOptions): Promise<FeedQueryResult>;
  findReels(options: ReelsQueryOptions): Promise<FeedQueryResult>;
  updateCaption(postId: string, caption: string, hashtags: string[]): Promise<PostEntity>;
  deleteById(postId: string): Promise<void>;
}

export class MongoPostRepository implements PostRepository {
  public async create(data: CreatePostInput): Promise<PostEntity> {
    const post = await PostModel.create({
      authorId: new mongoose.Types.ObjectId(data.authorId),
      caption: data.caption,
      media: data.media,
      hashtags: data.hashtags ?? []
    });

    return toDomainPost(post);
  }

  public async findFeed({ authorIds, limit, cursor, sortBy = 'recent' }: FeedQueryOptions): Promise<FeedQueryResult> {
    const normalizedIds = authorIds.map((id) => new mongoose.Types.ObjectId(id));

    const query: mongoose.FilterQuery<Post> = {
      authorId: { $in: normalizedIds },
      isDeleted: false
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    let documents;

    if (sortBy === 'relevance') {
      // Para ranking de relevancia, necesitamos calcular un score
      // Usamos agregación para calcular score y ordenar
      const now = new Date();
      documents = await PostModel.aggregate([
        { $match: query },
        {
          $addFields: {
            // Score de engagement: likes (1x), comments (2x), saves (1.5x), views (0.1x)
            engagementScore: {
              $add: [
                { $multiply: ['$likes', 1] },
                { $multiply: ['$comments', 2] },
                { $multiply: ['$saves', 1.5] },
                { $multiply: ['$views', 0.1] }
              ]
            },
            // Decaimiento temporal: posts más recientes tienen mayor peso
            hoursSinceCreation: {
              $divide: [{ $subtract: [now, '$createdAt'] }, 3600000] // Milisegundos a horas
            }
          }
        },
        {
          $addFields: {
            // Score final = engagementScore / (1 + hoursSinceCreation/24)
            // Esto hace que posts más recientes tengan ventaja, pero posts con mucho engagement aún destacan
            relevanceScore: {
              $divide: ['$engagementScore', { $add: [1, { $divide: ['$hoursSinceCreation', 24] }] }]
            }
          }
        },
        { $sort: { relevanceScore: -1 } },
        { $limit: fetchLimit }
      ]).exec();

      // Convertir los documentos agregados a formato Post
      const postIds = documents.map((doc: { _id: mongoose.Types.ObjectId }) => doc._id);
      const posts = await PostModel.find({ _id: { $in: postIds } }).exec();
      
      // Mantener el orden del agregado
      const postsMap = new Map(posts.map((post) => [post._id.toString(), post]));
      documents = postIds
        .map((id: mongoose.Types.ObjectId) => postsMap.get(id.toString()))
        .filter((post): post is PostDocument => post !== undefined);
    } else {
      // Orden cronológico (por defecto)
      documents = await PostModel.find(query)
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .exec();
    }

    const items = documents.map((doc) => toDomainPost(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async incrementLikes(postId: string): Promise<void> {
    await PostModel.findByIdAndUpdate(postId, { $inc: { likes: 1 } }).exec();
  }

  public async decrementLikes(postId: string): Promise<void> {
    await PostModel.findByIdAndUpdate(postId, { $inc: { likes: -1 } }).exec();
  }

  public async incrementComments(postId: string): Promise<void> {
    await PostModel.findByIdAndUpdate(postId, { $inc: { comments: 1 } }).exec();
  }

  public async findByAuthorId({ authorId, limit = 20, cursor }: UserPostsOptions): Promise<FeedQueryResult> {
    const query: mongoose.FilterQuery<Post> = {
      authorId: new mongoose.Types.ObjectId(authorId),
      isDeleted: false
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainPost(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async countByAuthorId(authorId: string): Promise<number> {
    return await PostModel.countDocuments({
      authorId: new mongoose.Types.ObjectId(authorId),
      isDeleted: false
    }).exec();
  }

  public async findById(postId: string): Promise<PostEntity | null> {
    const post = await PostModel.findById(postId).exec();
    return post ? toDomainPost(post) : null;
  }

  public async findManyByIds(postIds: string[]): Promise<PostEntity[]> {
    if (postIds.length === 0) {
      return [];
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    const posts = await PostModel.find({ _id: { $in: objectIds }, isDeleted: false }).exec();
    return posts.map((post) => toDomainPost(post));
  }

  /**
   * Busca posts para la página de explorar.
   * Ordena por un algoritmo de ranking que considera likes, comentarios, saves y fecha.
   */
  public async findExplore({ limit = 20, cursor, excludeAuthorIds = [] }: ExploreQueryOptions): Promise<FeedQueryResult> {
    const excludeIds = excludeAuthorIds.map((id) => new mongoose.Types.ObjectId(id));

    const query: mongoose.FilterQuery<Post> = {
      isDeleted: false
    };

    if (excludeIds.length > 0) {
      query.authorId = { $nin: excludeIds };
    }

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    // Algoritmo de ranking: combinación de engagement (likes + comments + saves) y fecha
    // Score = (likes * 2 + comments * 3 + saves * 1 + views * 0.1) / daysSinceCreation
    // Usamos agregación para calcular el score dinámicamente
    const fetchLimit = limit + 1;

    const documents = await PostModel.aggregate([
      { $match: query },
      {
        $addFields: {
          // Calcular días desde la creación (mínimo 1 para evitar división por 0)
          daysSinceCreation: {
            $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60 * 24]
          },
          engagementScore: {
            $add: [
              { $multiply: ['$likes', 2] },
              { $multiply: ['$comments', 3] },
              { $multiply: ['$saves', 1] },
              { $multiply: ['$views', 0.1] }
            ]
          }
        }
      },
      {
        $addFields: {
          rankingScore: {
            $divide: ['$engagementScore', { $max: ['$daysSinceCreation', 1] }]
          }
        }
      },
      { $sort: { rankingScore: -1, createdAt: -1 } },
      { $limit: fetchLimit }
    ]).exec();

    const items = documents.map((doc) => toDomainPost(doc as Post & { _id: mongoose.Types.ObjectId }));

    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  /**
   * Busca posts por un hashtag específico.
   */
  public async updateCaption(postId: string, caption: string, hashtags: string[]): Promise<PostEntity> {
    const post = await PostModel.findByIdAndUpdate(
      postId,
      { $set: { caption, hashtags } },
      { new: true }
    ).exec();

    if (!post) {
      throw new Error('Post not found');
    }

    return toDomainPost(post);
  }

  public async deleteById(postId: string): Promise<void> {
    await PostModel.findByIdAndUpdate(postId, { $set: { isDeleted: true } }).exec();
  }

  public async searchPosts({ query, limit = 20, cursor }: SearchPostsOptions): Promise<FeedQueryResult> {
    if (query.trim().length === 0) {
      return { items: [], hasMore: false };
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const queryFilter: mongoose.FilterQuery<Post> = {
      isDeleted: false,
      $or: [
        { caption: searchRegex },
        { hashtags: { $in: [new RegExp(query.trim(), 'i')] } }
      ]
    };

    if (cursor) {
      queryFilter.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await PostModel.find(queryFilter)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainPost(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async findByHashtag({ hashtag, limit = 20, cursor }: HashtagQueryOptions): Promise<FeedQueryResult> {
    const normalizedHashtag = hashtag.toLowerCase().trim();
    const query: mongoose.FilterQuery<Post> = {
      hashtags: normalizedHashtag,
      isDeleted: false
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainPost(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async findByHashtags({
    hashtags,
    limit = 20,
    cursor,
    excludeAuthorIds = []
  }: HashtagsQueryOptions): Promise<FeedQueryResult> {
    if (hashtags.length === 0) {
      return { items: [], hasMore: false };
    }

    const normalizedHashtags = hashtags.map((tag) => tag.toLowerCase().trim());
    const query: mongoose.FilterQuery<Post> = {
      hashtags: { $in: normalizedHashtags },
      isDeleted: false
    };

    if (excludeAuthorIds.length > 0) {
      const normalizedIds = excludeAuthorIds.map((id) => new mongoose.Types.ObjectId(id));
      query.authorId = { $nin: normalizedIds };
    }

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainPost(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async findReels({ limit = 20, cursor, excludeAuthorIds = [] }: ReelsQueryOptions): Promise<FeedQueryResult> {
    // Un reel es un post que:
    // 1. Tiene exactamente un media de tipo video
    // 2. La duración del video es <= 60 segundos (60000 ms)
    // 3. No está eliminado
    const query: mongoose.FilterQuery<Post> = {
      isDeleted: false,
      'media.kind': 'video',
      'media.durationMs': { $lte: 60000 }, // 60 segundos máximo
      $expr: {
        // Asegurar que solo hay un media (reels son videos únicos)
        $eq: [{ $size: '$media' }, 1]
      }
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    if (excludeAuthorIds.length > 0) {
      const normalizedIds = excludeAuthorIds.map((id) => new mongoose.Types.ObjectId(id));
      query.authorId = { $nin: normalizedIds };
    }

    const fetchLimit = limit + 1;
    const documents = await PostModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainPost(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }
}


