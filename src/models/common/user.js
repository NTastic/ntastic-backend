import mongoose from 'mongoose';
import { IMAGES_FILES } from '../../gridfs.js';

export const MODEL_USER = 'common.User';
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  isBot: { type: Boolean, default: false },
  avatarId: { type: mongoose.Schema.Types.ObjectId, ref: IMAGES_FILES },
  storageUsed: { type: Number, default: 0 },
  charIds: [{ type: mongoose.Schema.Types.ObjectId }],
  faveCatIds: [{ type: mongoose.Schema.Types.ObjectId }],
  faveSubCatIds: [{ type: mongoose.Schema.Types.ObjectId }],
}, { timestamps: true });

const User = mongoose.model(MODEL_USER, UserSchema);
export default User;
