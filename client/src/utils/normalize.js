import { hostels as fallbackHostels, roomListings as fallbackRooms } from "../data/mockData";

const fallbackBySlug = (slug) => fallbackHostels.find((hostel) => hostel.slug === slug) || fallbackHostels[0];

const normalizeCoordinates = (source, fallback) => {
  if (source?.coordinates?.lat && source?.coordinates?.lng) return source.coordinates;
  if (Array.isArray(source?.location?.coordinates)) return { lat: source.location.coordinates[1], lng: source.location.coordinates[0] };
  if (source?.location?.lat && source?.location?.lng) return source.location;
  return fallback;
};

export const normalizeHostel = (hostel = {}) => {
  const fallback = hostel.slug ? fallbackBySlug(hostel.slug) : fallbackHostels[0];
  const ratingObject = typeof hostel.rating === "object" ? hostel.rating : null;
  const imageList = hostel.images?.length ? hostel.images : fallback.images;
  const coordinates = normalizeCoordinates(hostel, fallback.coordinates);

  return {
    ...fallback,
    ...hostel,
    id: hostel.id || hostel._id || fallback.id,
    type: hostel.type ? hostel.type[0].toUpperCase() + hostel.type.slice(1) : fallback.type,
    image: hostel.image || imageList?.[0] || fallback.image,
    gallery: hostel.gallery || imageList || fallback.gallery,
    images: imageList || fallback.images,
    price: hostel.price || hostel.minPrice || fallback.price,
    maxPrice: hostel.maxPrice || fallback.maxPrice,
    rating: ratingObject ? ratingObject.average : hostel.rating || fallback.rating,
    reviews: ratingObject ? ratingObject.count : hostel.reviews || fallback.reviews,
    verified: hostel.verified ?? hostel.isVerified ?? fallback.verified,
    featured: hostel.featured ?? hostel.isFeatured ?? fallback.featured,
    left: hostel.left ?? hostel.availabilityLeft ?? fallback.left,
    tags: hostel.tags || (hostel.amenities || fallback.amenities).slice(0, 3),
    universities: hostel.universities || (hostel.nearbyUniversities || []).map((item) => item.name) || fallback.universities,
    coordinates
  };
};

export const normalizeHostels = (items = []) => items.map(normalizeHostel);

export const normalizeRoom = (room = {}) => {
  const fallback = fallbackRooms.find((item) => item.id === room.id || item.id === room._id) || fallbackRooms[0];
  const photos = room.photos?.length ? room.photos : room.images?.length ? room.images : fallback.photos;
  const coordinates = normalizeCoordinates(room, fallback.coordinates);
  return {
    ...fallback,
    ...room,
    id: room.id || room._id || fallback.id,
    title: room.title || fallback.title,
    image: room.image || photos?.[0] || fallback.image,
    photos,
    pricePerHead: room.pricePerHead || room.pricePerBed || fallback.pricePerHead,
    pricePerRoom: room.pricePerRoom || fallback.pricePerRoom,
    amenities: room.amenities || room.facilities || fallback.amenities,
    totalBeds: room.totalBeds ?? fallback.totalBeds,
    availableBeds: room.availableBeds ?? fallback.availableBeds,
    roomType: room.roomType || fallback.roomType,
    listingCategory: room.listingCategory || fallback.listingCategory,
    genderPolicy: room.genderPolicy || fallback.genderPolicy,
    mealPlan: room.mealPlan || fallback.mealPlan,
    mealCost: room.mealCost ?? fallback.mealCost,
    coordinates,
    lister: room.lister || fallback.lister,
    virtualTourUrl: room.virtualTourUrl || fallback.virtualTourUrl,
    panoramaUrl: room.panoramaUrl || fallback.panoramaUrl,
    description: room.description || fallback.description,
    descriptionUrdu: room.descriptionUrdu || fallback.descriptionUrdu
  };
};

export const normalizeRooms = (items = []) => items.map(normalizeRoom);
