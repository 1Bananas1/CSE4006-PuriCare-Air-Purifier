const { initializeFirebase } = require('../config/firebase');

class UserService {
  constructor() {
    const { db, auth } = initializeFirebase();
    this.db = db;
    this.auth = auth;
    this.usersCollection = db.collection('users');
  }

  // Create a new user in Firestore (called after Firebase Auth signup)
  async createUser(uid, userData) {
    try {
      const userDoc = {
        uid,
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceCount: 0,
      };

      await this.usersCollection.doc(uid).set(userDoc);
      return userDoc;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Get user by UID
  async getUserByUid(uid) {
    try {
      const userDoc = await this.usersCollection.doc(uid).get();

      if (!userDoc.exists) {
        return null;
      }

      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  // Get user by email
  async getUserByEmail(email) {
    try {
      const snapshot = await this.usersCollection
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUser(uid, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await this.usersCollection.doc(uid).update(updateData);
      return await this.getUserByUid(uid);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Increment device count
  async incrementDeviceCount(uid) {
    try {
      const userRef = this.usersCollection.doc(uid);
      await userRef.update({
        deviceCount: this.db.FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error incrementing device count:', error);
      throw error;
    }
  }

  // Decrement device count
  async decrementDeviceCount(uid) {
    try {
      const userRef = this.usersCollection.doc(uid);
      await userRef.update({
        deviceCount: this.db.FieldValue.increment(-1),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error decrementing device count:', error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(uid) {
    try {
      // Delete from Firestore
      await this.usersCollection.doc(uid).delete();

      // Delete from Firebase Auth
      await this.auth.deleteUser(uid);

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Get all users (admin function)
  async getAllUsers(limit = 100) {
    try {
      const snapshot = await this.usersCollection.limit(limit).get();

      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
}

module.exports = new UserService();
