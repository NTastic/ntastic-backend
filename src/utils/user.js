import User from '../models/User.js';

export const validateUser = async (userId) => {
  if (!userId) throw new Error('Authentication required');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  return user;
}