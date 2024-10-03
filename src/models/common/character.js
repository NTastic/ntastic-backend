import mongoose from 'mongoose';

export const MODEL_CHARACTER = 'common.Character';
const CharacterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
}, { timestamps: true });

CharacterSchema.index({ slug: 1 }, { unique: true });

const Character = mongoose.model(MODEL_CHARACTER, CharacterSchema);
export default Character;
