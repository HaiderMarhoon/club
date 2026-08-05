// utils/firestore-helpers.js
// Firestore returns Timestamp objects for any field you saved as a JS Date.
// Your EJS views call things like `.toLocaleDateString()` or `.toISOString()`
// directly on those fields (leftover from Mongoose, which returned real Dates).
// These helpers convert Timestamps back into plain JS Dates recursively, so
// existing views don't need to be touched.

function convertTimestamps(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(convertTimestamps);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = convertTimestamps(value[key]);
    }
    return out;
  }
  return value;
}

// Turns a Firestore DocumentSnapshot into a plain object with _id/id set
// and all Timestamp fields converted to Date. Returns null if the doc doesn't exist.
function docToObject(doc) {
  if (!doc || !doc.exists) return null;
  return { _id: doc.id, id: doc.id, ...convertTimestamps(doc.data()) };
}

// Same, but for every doc in a QuerySnapshot.
function snapToArray(snap) {
  return snap.docs.map(docToObject);
}

module.exports = { convertTimestamps, docToObject, snapToArray };