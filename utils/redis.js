// utils/redis.js
import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.connected = false;

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      this.connected = true;
    });

    this.client.on('end', () => {
      this.connected = false;
    });

    this.client.connect()
      .then(() => {
        this.connected = true;
      })
      .catch((err) => {
        console.error('Redis connection failed:', err);
      });
  }

  isAlive() {
    return this.connected;
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value;
    } catch (err) {
      console.error(`Error getting key ${key}:`, err);
      return null;
    }
  }

  async set(key, value, duration) {
    try {
      if (duration) {
        await this.client.set(key, value, { EX: duration });
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.error(`Error setting key ${key}:`, err);
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (err) {
      console.error(`Error deleting key ${key}:`, err);
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
