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

const toDomainPost = (doc: DocumentType<Post>): PostEntity => {
  const plain = doc.toObject<Post & { _id: mongoose.Types.ObjectId }>();

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

export interface PostRepository {
  create(data: CreatePostInput): Promise<PostEntity>;
  findFeed(options: FeedQueryOptions): Promise<FeedQueryResult>;
  incrementLikes(postId: string): Promise<void>;
  decrementLikes(postId: string): Promise<void>;
  incrementComments(postId: string): Promise<void>;
  findById(postId: string): Promise<PostEntity | null>;
}

export class MongoPostRepository implements PostRepository {
  public async create(data: CreatePostInput): Promise<PostEntity> {
    const post = await PostModel.create({
      authorId: new mongoose.Types.ObjectId(data.authorId),
      caption: data.caption,
      media: data.media
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

  public async findById(postId: string): Promise<PostEntity | null> {
    const post = await PostModel.findById(postId).exec();
    return post ? toDomainPost(post) : null;
  }
}


