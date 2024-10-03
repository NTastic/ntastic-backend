import mongoose from 'mongoose';
import { IMAGES_FILES } from '../gridfs.js';

export const MODEL_USER = 'User';
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  isBot: { type: Boolean, default: false },
  avatarImageId: { type: mongoose.Schema.Types.ObjectId, ref: IMAGES_FILES },
  storageUsed: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model(MODEL_USER, UserSchema);
export default User;
