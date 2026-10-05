import bcrypt from 'bcryptjs';
import { getDb, ObjectId } from '../db.js';

const COLLECTION = 'users';
const BCRYPT_ROUNDS = 12;

/**
 * @typedef {{
 *   _id: import('mongodb').ObjectId,
 *   name: string,
 *   email: string,
 *   phone: string,
 *   city: string,
 *   ageBand: string,
 *   passwordHash: string,
 *   avatarFileId?: import('mongodb').ObjectId | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} UserDoc
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   email: string,
 *   phone: string,
 *   city: string,
 *   ageBand: string,
 *   provider: string,
 *   avatarUrl: string | null,
 * }} PublicUser
 */

/** @returns {import('mongodb').Collection<UserDoc>} */
function users() {
  return /** @type {import('mongodb').Collection<UserDoc>} */ (getDb().collection(COLLECTION));
}

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * @param {string} password
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * @param {string} email
 * @returns {Promise<UserDoc | null>}
 */
export async function findUserByEmail(email) {
  return users().findOne({ email: email.trim().toLowerCase() });
}

/**
 * @param {string} id
 * @returns {Promise<UserDoc | null>}
 */
export async function findUserById(id) {
  if (!ObjectId.isValid(id)) return null;
  return users().findOne({ _id: new ObjectId(id) });
}

/**
 * @param {{
 *   name: string,
 *   email: string,
 *   phone: string,
 *   city: string,
 *   ageBand: string,
 *   password: string,
 * }} input
 * @returns {Promise<UserDoc>}
 */
export async function createUser(input) {
  const now = new Date();
  const doc = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    city: input.city,
    ageBand: input.ageBand,
    passwordHash: await hashPassword(input.password),
    avatarFileId: null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await users().insertOne(/** @type {UserDoc} */ (doc));
  return { ...doc, _id: result.insertedId };
}

/**
 * @param {string} userId
 * @param {import('mongodb').ObjectId} fileId
 */
export async function setUserAvatar(userId, fileId) {
  await users().updateOne(
    { _id: new ObjectId(userId) },
    { $set: { avatarFileId: fileId, updatedAt: new Date() } },
  );
}

/**
 * Safe profile for API responses (never includes passwordHash).
 * @param {UserDoc} user
 * @returns {PublicUser}
 */
export function toPublicUser(user) {
  const id = String(user._id);
  return {
    id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    ageBand: user.ageBand,
    provider: 'email',
    avatarUrl: user.avatarFileId ? `/api/media/avatar/${id}` : null,
  };
}
