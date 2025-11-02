import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { PostModel, Post, PostMedia } from '../models/post.model.js';

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

const toDomainPost = (doc: DocumentType<Post> | (Post & { _id: mongoose.Types.ObjectId })): PostEntity => {
  const plain = 'toObject' in doc ? doc.toObject<Post & { _id: mongoose.Types.ObjectId }>() : doc;

  return {
    id: plain._id.toString(),
    authorId: plain.authorId.toString(),
    caption: plain.caption,
    media: plain.media,
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

export interface PostRepository {
  create(data: CreatePostInput): Promise<PostEntity>;
  findFeed(options: FeedQueryOptions): Promise<FeedQueryResult>;
  findByAuthorId(options: UserPostsOptions): Promise<FeedQueryResult>;
  countByAuthorId(authorId: string): Promise<number>;
  incrementLikes(postId: string): Promise<void>;
  decrementLikes(postId: string): Promise<void>;
  incrementComments(postId: string): Promise<void>;
  findById(postId: string): Promise<PostEntity | null>;
  findExplore(options: ExploreQueryOptions): Promise<FeedQueryResult>;
  findByHashtag(options: HashtagQueryOptions): Promise<FeedQueryResult>;
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

  public async findFeed({ authorIds, limit, cursor }: FeedQueryOptions): Promise<FeedQueryResult> {
    const normalizedIds = authorIds.map((id) => new mongoose.Types.ObjectId(id));

    const query: mongoose.FilterQuery<Post> = {
      authorId: { $in: normalizedIds },
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
}


