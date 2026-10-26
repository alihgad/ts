import { Schema, model } from 'mongoose';

class UserModel {
  readonly model = model('User', new Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  }, { timestamps: true, versionKey: false }));
}

export default new UserModel();
