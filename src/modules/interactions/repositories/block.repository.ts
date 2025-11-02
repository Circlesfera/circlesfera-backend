import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { BlockModel, Block } from '../models/block.model.js';

export interface BlockEntity {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockRepository {
  create(blockerId: string, blockedId: string): Promise<BlockEntity>;
  delete(blockerId: string, blockedId: string): Promise<void>;
  exists(blockerId: string, blockedId: string): Promise<boolean>;
  findBlockedIds(blockerId: string): Promise<string[]>;
  findBlockerIds(blockedId: string): Promise<string[]>;
  findMutualBlocks(userId1: string, userId2: string): Promise<{ user1BlocksUser2: boolean; user2BlocksUser1: boolean }>;
}

const toDomainBlock = (doc: DocumentType<Block>): BlockEntity => {
  const plain = doc.toObject<Block & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    blockerId: plain.blockerId.toString(),
    blockedId: plain.blockedId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoBlockRepository implements BlockRepository {
  public async create(blockerId: string, blockedId: string): Promise<BlockEntity> {
    if (blockerId === blockedId) {
      throw new Error('Un usuario no puede bloquearse a sí mismo');
    }

    const existing = await BlockModel.findOne({
      blockerId: new mongoose.Types.ObjectId(blockerId),
      blockedId: new mongoose.Types.ObjectId(blockedId)
    }).exec();

    if (existing) {
      return toDomainBlock(existing);
    }

    const block = await BlockModel.create({
      blockerId: new mongoose.Types.ObjectId(blockerId),
      blockedId: new mongoose.Types.ObjectId(blockedId)
    });

    return toDomainBlock(block);
  }

  public async delete(blockerId: string, blockedId: string): Promise<void> {
    await BlockModel.deleteOne({
      blockerId: new mongoose.Types.ObjectId(blockerId),
      blockedId: new mongoose.Types.ObjectId(blockedId)
    }).exec();
  }

  public async exists(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await BlockModel.countDocuments({
      blockerId: new mongoose.Types.ObjectId(blockerId),
      blockedId: new mongoose.Types.ObjectId(blockedId)
    }).exec();

    return count > 0;
  }

  public async findBlockedIds(blockerId: string): Promise<string[]> {
    const blocks = await BlockModel.find({
      blockerId: new mongoose.Types.ObjectId(blockerId)
    })
      .select('blockedId')
      .exec();

    return blocks.map((block) => block.blockedId.toString());
  }

  public async findBlockerIds(blockedId: string): Promise<string[]> {
    const blocks = await BlockModel.find({
      blockedId: new mongoose.Types.ObjectId(blockedId)
    })
      .select('blockerId')
      .exec();

    return blocks.map((block) => block.blockerId.toString());
  }

  public async findMutualBlocks(userId1: string, userId2: string): Promise<{ user1BlocksUser2: boolean; user2BlocksUser1: boolean }> {
    const [user1BlocksUser2, user2BlocksUser1] = await Promise.all([
      this.exists(userId1, userId2),
      this.exists(userId2, userId1)
    ]);

    return {
      user1BlocksUser2,
      user2BlocksUser1
    };
  }
}

