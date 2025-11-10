import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { CommentModel, Comment } from '../models/comment.model.js';
import type { InteractionTargetModel } from './like.repository.js';

export interface CommentEntity {
  id: string;
  targetId: string;
  postId: string; // alias legacy
  targetModel: InteractionTargetModel;
  authorId: string;
  parentId?: string;
  content: string;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string;
  targetModel?: InteractionTargetModel;
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

const DEFAULT_TARGET_MODEL: InteractionTargetModel = 'Post';

const toDomainComment = (doc: DocumentType<Comment>): CommentEntity => {
  const plain = doc.toObject<Comment & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    targetId: plain.targetId.toString(),
    postId: plain.targetId.toString(),
    targetModel: plain.targetModel,
    authorId: plain.authorId.toString(),
    parentId: plain.parentId?.toString(),
    content: plain.content,
    likes: plain.likes,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export interface CommentRepository {
  create(data: CreateCommentInput): Promise<CommentEntity>;
  findByPostId(options: CommentQueryOptions, targetModel?: InteractionTargetModel): Promise<CommentQueryResult>;
  countByPostId(postId: string, targetModel?: InteractionTargetModel): Promise<number>;
  findById(commentId: string): Promise<CommentEntity | null>;
  findRepliesByCommentId(commentId: string): Promise<CommentEntity[]>;
}

export class MongoCommentRepository implements CommentRepository {
  public async create(data: CreateCommentInput): Promise<CommentEntity> {
    const targetModel = data.targetModel ?? DEFAULT_TARGET_MODEL;
    const comment = await CommentModel.create({
      targetModel,
      targetId: new mongoose.Types.ObjectId(data.postId),
      authorId: new mongoose.Types.ObjectId(data.authorId),
      content: data.content,
      parentId: data.parentId ? new mongoose.Types.ObjectId(data.parentId) : undefined
    });

    return toDomainComment(comment);
  }

  public async findByPostId({ postId, limit, cursor }: CommentQueryOptions, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<CommentQueryResult> {
    const query: mongoose.FilterQuery<Comment> = {
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      parentId: { $exists: false }
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

  public async findRepliesByCommentId(commentId: string): Promise<CommentEntity[]> {
    const documents = await CommentModel.find({
      parentId: new mongoose.Types.ObjectId(commentId)
    })
      .sort({ createdAt: 1 })
      .exec();

    return documents.map((doc) => toDomainComment(doc));
  }

  public async countByPostId(postId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<number> {
    return await CommentModel.countDocuments({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }

  public async findById(commentId: string): Promise<CommentEntity | null> {
    const comment = await CommentModel.findById(commentId).exec();
    return comment ? toDomainComment(comment) : null;
  }
}

