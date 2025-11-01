import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { CommentModel, Comment } from '../models/comment.model.js';

export interface CommentEntity {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  content: string;
}

export interface CommentQueryOptions {
  postId: string;
  limit: number;
  cursor?: Date;
}

export interface CommentQueryResult {
  items: CommentEntity[];
  hasMore: boolean;
}

export interface CommentRepository {
  create(data: CreateCommentInput): Promise<CommentEntity>;
  findByPostId(options: CommentQueryOptions): Promise<CommentQueryResult>;
  countByPostId(postId: string): Promise<number>;
  findById(commentId: string): Promise<CommentEntity | null>;
}

const toDomainComment = (doc: DocumentType<Comment>): CommentEntity => {
  const plain = doc.toObject<Comment & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    postId: plain.postId.toString(),
    authorId: plain.authorId.toString(),
    content: plain.content,
    likes: plain.likes,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoCommentRepository implements CommentRepository {
  public async create(data: CreateCommentInput): Promise<CommentEntity> {
    const comment = await CommentModel.create({
      postId: new mongoose.Types.ObjectId(data.postId),
      authorId: new mongoose.Types.ObjectId(data.authorId),
      content: data.content
    });

    return toDomainComment(comment);
  }

  public async findByPostId({ postId, limit, cursor }: CommentQueryOptions): Promise<CommentQueryResult> {
    const query: mongoose.FilterQuery<Comment> = {
      postId: new mongoose.Types.ObjectId(postId)
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await CommentModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainComment(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async countByPostId(postId: string): Promise<number> {
    return await CommentModel.countDocuments({
      postId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }

  public async findById(commentId: string): Promise<CommentEntity | null> {
    const comment = await CommentModel.findById(commentId).exec();
    return comment ? toDomainComment(comment) : null;
  }
}

