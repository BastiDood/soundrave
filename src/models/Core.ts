import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  url: { type: String, required: true },
});

const ArtistSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  followers: { type: Number, required: true },
  popularity: { type: Number, required: true, min: 0, max: 100 },
  images: [ { type: ImageSchema, required: true } ],
});

const ReleaseSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  albumType: { type: String, enum: [ 'album', 'single', 'compilation' ], required: true },
  releaseDate: { type: Number, required: true },
  datePrecision: { type: String, enum: [ 'year', 'month', 'day' ], required: true },
  availableCountries: { type: [ String ], required: true },
  images: [ { type: ImageSchema, required: true } ],
  artists: { type: [ { type: String, ref: 'Artist', required: true } ], required: true },
});

export const Artist = mongoose.model('Artist', ArtistSchema);
export const Release = mongoose.model('Release', ReleaseSchema);
