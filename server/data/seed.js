require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const { users, hostels, rooms, reviews, bookings } = require("./mockData");

const seed = async () => {
  const connected = await connectDB();
  if (!connected) {
    console.log("Set MONGO_URI in server/.env before running npm run seed.");
    process.exit(1);
  }

  await Promise.all([User.deleteMany(), Hostel.deleteMany(), Room.deleteMany(), Review.deleteMany(), Booking.deleteMany()]);

  const createdUsers = {};
  for (const user of users) {
    createdUsers[user.id] = await User.create(user);
  }

  const createdHostels = {};
  for (const hostel of hostels) {
    createdHostels[hostel.id] = await Hostel.create({
      ...hostel,
      owner: createdUsers[hostel.owner]._id,
      status: hostel.isVerified ? "active" : "pending",
      images: hostel.images.map((url, index) => ({ url, caption: index === 0 ? "Primary room view" : "Gallery image" }))
    });
  }

  const createdRooms = {};
  for (const room of rooms) {
    const roomHostel = room.hostel ? createdHostels[room.hostel]?._id : undefined;
    const roomLister = room.listedBy ? createdUsers[room.listedBy]?._id : createdUsers["u-owner"]._id;
    createdRooms[room.id] = await Room.create({
      ...room,
      hostel: roomHostel,
      hostProperty: roomHostel,
      listedBy: roomLister
    });
  }

  for (const review of reviews) {
    await Review.create({
      hostel: createdHostels[review.hostel]._id,
      student: createdUsers["u-student"]._id,
      rating: review.rating,
      comment: review.comment,
      isVerifiedStay: true
    });
  }

  for (const booking of bookings) {
    await Booking.create({
      ...booking,
      student: createdUsers[booking.student]._id,
      hostel: createdHostels[booking.hostel]._id,
      room: createdRooms[booking.room]._id
    });
  }

  console.log("Basera seed data inserted.");
  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
