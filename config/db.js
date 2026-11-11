import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = { bufferCommands: false };

    cached.promise = mongoose
      .connect(`${process.env.MONGODB_URI}`, opts)
      .then((Mongoose) => {
        console.log("✅ MongoDB connected");
        return mongoose;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
// ✅ Summary (What We're Doing)
// We're connecting to a MongoDB database (named adesign) via Mongoose.

// We're ensuring that only one connection is reused across requests or reloads using global.mongoose.

// This function is usually called once per API route or server-side function before accessing the database.
