import 'dotenv/config';

import mongoose from 'mongoose';
import type { DocumentType } from '@typegoose/typegoose';

import { PostModel, Post } from '@modules/feed/models/post.model.js';
import { FrameModel } from '@modules/frames/models/frame.model.js';
import { LikeModel } from '@modules/interactions/models/like.model.js';
import { SaveModel } from '@modules/interactions/models/save.model.js';
import { CommentModel } from '@modules/interactions/models/comment.model.js';
import { MentionModel } from '@modules/feed/models/mention.model.js';

const FALLBACK_LOCAL_URI = 'mongodb://127.0.0.1:27017/circlesfera';

const BULK_BATCH_SIZE = 500;
const POST_BATCH_SIZE = 500;

const resolvedMongoUri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  (process.env.NODE_ENV !== 'production' ? FALLBACK_LOCAL_URI : undefined);

if (!resolvedMongoUri) {
  throw new Error('MONGODB_URI no está configurado. Define la variable de entorno antes de ejecutar la migración.');
}

const MONGO_URI = resolvedMongoUri;

type BulkOperation<T extends mongoose.Model<any>> = Parameters<T['bulkWrite']>[0][number];

async function runBulkUpdate<T extends mongoose.Model<any>>(
  model: T,
  filter: mongoose.FilterQuery<mongoose.Document>,
  buildOperation: (doc: mongoose.Document & { _id: mongoose.Types.ObjectId }) => BulkOperation<T> | null,
  session: mongoose.ClientSession
): Promise<void> {
  const cursor = model
    .find(filter)
    .session(session)
    .cursor();

  const operations: Parameters<T['bulkWrite']>[0] = [];

  for await (const rawDoc of cursor as AsyncIterable<mongoose.Document>) {
    const doc = rawDoc as mongoose.Document & { _id: mongoose.Types.ObjectId };
    const operation = buildOperation(doc);
    if (!operation) {
      continue;
    }

    operations.push(operation);

    if (operations.length >= BULK_BATCH_SIZE) {
      await model.bulkWrite(operations, { session });
      operations.length = 0;
    }
  }

  if (operations.length > 0) {
    await model.bulkWrite(operations, { session });
  }

  await cursor.close();
}

async function ensureTargetModelDefaults(session: mongoose.ClientSession): Promise<void> {
  await Promise.all([
    runBulkUpdate(
      LikeModel,
      { targetModel: { $exists: false } },
      (doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { targetModel: 'Post' } }
        }
      }),
      session
    ),
    runBulkUpdate(
      SaveModel,
      { targetModel: { $exists: false } },
      (doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { targetModel: 'Post' } }
        }
      }),
      session
    ),
    runBulkUpdate(
      CommentModel,
      { targetModel: { $exists: false } },
      (doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { targetModel: 'Post' } }
        }
      }),
      session
    ),
    runBulkUpdate(
      MentionModel,
      { targetModel: { $exists: false } },
      (doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { targetModel: 'Post' } }
        }
      }),
      session
    )
  ]);
}

async function renameLegacyFields(session: mongoose.ClientSession): Promise<void> {
  const buildRenameOperation = <T extends mongoose.Model<any>>(
    doc: mongoose.Document & { _id: mongoose.Types.ObjectId }
  ): BulkOperation<T> | null => {
    const legacyId = doc.get('postId');
    const currentTargetModel = doc.get('targetModel') ?? 'Post';

    if (!legacyId) {
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $unset: { postId: '' } }
        }
      } as BulkOperation<T>;
    }

    return {
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            targetId: legacyId,
            targetModel: currentTargetModel ?? 'Post'
          },
          $unset: { postId: '' }
        }
      }
    } as BulkOperation<T>;
  };

  await Promise.all([
    runBulkUpdate(LikeModel, { postId: { $exists: true } }, (doc) => buildRenameOperation<typeof LikeModel>(doc), session),
    runBulkUpdate(SaveModel, { postId: { $exists: true } }, (doc) => buildRenameOperation<typeof SaveModel>(doc), session),
    runBulkUpdate(CommentModel, { postId: { $exists: true } }, (doc) => buildRenameOperation<typeof CommentModel>(doc), session),
    runBulkUpdate(MentionModel, { postId: { $exists: true } }, (doc) => buildRenameOperation<typeof MentionModel>(doc), session)
  ]);
}

async function migratePostsToFrames(session: mongoose.ClientSession): Promise<void> {
  const criteria = {
    isDeleted: false,
    'media.kind': 'video',
    'media.durationMs': { $lte: 60_000 },
    media: { $size: 1 }
  } as const;

  const totalCandidates = await PostModel.countDocuments(criteria).session(session);

  if (totalCandidates === 0) {
    console.log('No se encontraron posts candidatos para migrar.');
    return;
  }

  console.log(`Migrando ${totalCandidates} posts a la colección frames...`);

  type PostDocument = DocumentType<Post>;

  const cursor = PostModel.find(criteria).session(session).cursor();
  const batch: PostDocument[] = [];
  let totalMigrated = 0;

  const processBatch = async (docs: PostDocument[]): Promise<number> => {
    if (docs.length === 0) {
      return 0;
    }

    const candidateIds = docs.map((post) => post._id);
    const existingFrames = await FrameModel.find({ legacyPostId: { $in: candidateIds } })
      .select('legacyPostId')
      .session(session);
    const alreadyMigrated = new Set(
      existingFrames.map((frame) => frame.legacyPostId?.toString()).filter((value): value is string => Boolean(value))
    );

    const postsToMigrate = docs.filter((post) => !alreadyMigrated.has(post._id.toString()));

    if (postsToMigrate.length === 0) {
      return 0;
    }

    const frameInserts = postsToMigrate.map((post) => ({
      authorId: post.authorId,
      caption: post.caption,
      media: post.media,
      likes: post.likes,
      comments: post.comments,
      saves: post.saves,
      shares: post.shares,
      views: post.views,
      legacyPostId: post._id
    }));

    const createdFrames = await FrameModel.insertMany(frameInserts, { session });
    const frameMap = new Map<string, mongoose.Types.ObjectId>();

    createdFrames.forEach((frame) => {
      if (frame.legacyPostId) {
        frameMap.set(frame.legacyPostId.toString(), frame._id);
      }
    });

    const buildInteractionOps = (postId: mongoose.Types.ObjectId, frameId: mongoose.Types.ObjectId) => ({
      updateMany: {
        filter: { targetId: postId },
        update: { $set: { targetId: frameId, targetModel: 'Frame' } }
      }
    });

    const likeBulkOps: Parameters<typeof LikeModel.bulkWrite>[0] = [];
    const saveBulkOps: Parameters<typeof SaveModel.bulkWrite>[0] = [];
    const commentBulkOps: Parameters<typeof CommentModel.bulkWrite>[0] = [];
    const mentionBulkOps: Parameters<typeof MentionModel.bulkWrite>[0] = [];
    const postBulkOps: Parameters<typeof PostModel.bulkWrite>[0] = [];

    for (const post of postsToMigrate) {
      const frameId = frameMap.get(post._id.toString());
      if (!frameId) {
        continue;
      }

      likeBulkOps.push(buildInteractionOps(post._id, frameId));
      saveBulkOps.push(buildInteractionOps(post._id, frameId));
      commentBulkOps.push(buildInteractionOps(post._id, frameId));
      mentionBulkOps.push(buildInteractionOps(post._id, frameId));

      postBulkOps.push({
        updateOne: {
          filter: { _id: post._id },
          update: { $set: { isDeleted: true, isArchived: true } }
        }
      });
    }

    if (likeBulkOps.length > 0) {
      await LikeModel.bulkWrite(likeBulkOps, { session });
    }
    if (saveBulkOps.length > 0) {
      await SaveModel.bulkWrite(saveBulkOps, { session });
    }
    if (commentBulkOps.length > 0) {
      await CommentModel.bulkWrite(commentBulkOps, { session });
    }
    if (mentionBulkOps.length > 0) {
      await MentionModel.bulkWrite(mentionBulkOps, { session });
    }
    if (postBulkOps.length > 0) {
      await PostModel.bulkWrite(postBulkOps, { session });
    }

    return createdFrames.length;
  };

  for await (const post of cursor as AsyncIterable<mongoose.Document>) {
    batch.push(post as PostDocument);
    if (batch.length >= POST_BATCH_SIZE) {
      const docs = batch.splice(0, batch.length);
      totalMigrated += await processBatch(docs);
    }
  }

  if (batch.length > 0) {
    const docs = batch.splice(0, batch.length);
    totalMigrated += await processBatch(docs);
  }

  await cursor.close();

  console.log(`Frames creados: ${totalMigrated}`);
}

async function migrateFrames(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await ensureTargetModelDefaults(session);
      await renameLegacyFields(session);
      await migratePostsToFrames(session);
    });

    console.log('Migración completada correctamente.');
  } catch (error) {
    console.error('Error durante la migración de frames:', error);
    throw error;
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

void migrateFrames().catch(() => {
  process.exit(1);
});
