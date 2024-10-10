import { User } from '../models/index.js';

export const validateUser = async (userId) => {
  if (!userId) throw new Error('Authentication required');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  return user;
};

export const addRefreshToken = async (
  user,
  refreshToken,
  deviceInfo = null,
  expiresDays = 7,
) => {
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
  // Add the new refresh token to the beginning of the array
  
  user.refreshTokens.unshift({
    token: refreshToken,
    expiresAt,
    deviceInfo,
  });

  // limit the array to length 3
  if (user.refreshTokens.length > 3) {
    // remove the oldest tokens beyond the third one
    user.refreshTokens = user.refreshTokens.slice(0, 3);
  }

  await user.save();
}