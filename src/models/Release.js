import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  url: { type: String, required: true }
});

const ArtistSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: { type: String, required: true },
  followers: { type: Number, required: true },
  popularity: { type: Number, required: true, min: 0, max: 100 },
  images: [ ImageSchema ]
});

const ReleaseSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  title: { type: String, required: true },
  releaseDate: { type: Date, required: true },
  datePrecision: { type: String, enum: [ 'year', 'month', 'day' ], required: true },
  images: [ { type: ImageSchema, required: true } ],
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true }
});

export const Release = mongoose.model('Release', ReleaseSchema);
export const Artist = mongoose.model('Artist', ArtistSchema);
