import dotenv from 'dotenv';

dotenv.config();

export const environment =  process.env.NODE_ENV;
console.log(environment)
export const PORT = process.env.PORT;
export const MONGO_URL = process.env.MONGO_URL;
export const JWT_SECRET = process.env.JWT_SECRET;
export const REDIS_URL = process.env.REDIS_URL;
export const logDirectory = process.env.LOG_DIR;


if (!PORT && !MONGO_URL && !JWT_SECRET && !REDIS_URL && !logDirectory && !environment) {
    console.error("No .env variables provided in config.js file.")
    throw new Error("No .env variables provided in config.js file.")
}
