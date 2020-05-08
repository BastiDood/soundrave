import { Schema } from 'mongoose';

export const JobStatusSchema = new Schema({
  isRunning: { type: Boolean, required: true },
  dateLastDone: { type: Number, required: true },
});
