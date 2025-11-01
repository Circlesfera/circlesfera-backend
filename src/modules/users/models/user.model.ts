import {
  getModelForClass,
  modelOptions,
  pre,
  prop,
  ReturnModelType
} from '@typegoose/typegoose';

@pre<User>('save', function handleLowercase() {
  this.email = this.email.toLowerCase();
  this.handle = this.handle.toLowerCase();
})
@modelOptions({
  schemaOptions: {
    collection: 'users',
    timestamps: true
  }
})
export class User {
  public id!: string;

  @prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    type: () => String
  })
  public email!: string;

  @prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    type: () => String
  })
  public handle!: string;

  @prop({ required: true, trim: true, type: () => String })
  public displayName!: string;

  @prop({ required: true, select: false, type: () => String })
  public passwordHash!: string;

  @prop({ default: null, type: () => String })
  public bio?: string | null;

  @prop({ default: null, type: () => String })
  public avatarUrl?: string | null;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const UserModel: ReturnModelType<typeof User> = getModelForClass(User);

