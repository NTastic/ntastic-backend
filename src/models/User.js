import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  isBot: { type: Boolean, default: false },
  avatarImageId: { type: mongoose.Schema.Types.ObjectId, ref: 'images.files' },
  storageUsed: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
export default User;
