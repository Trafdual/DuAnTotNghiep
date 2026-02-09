const mongoose = require('mongoose')

const chapterSchema = new mongoose.Schema({
  mangaName: String,
  number: String,
  content: String,
  viporfree: { type: String, enum: ['vip', 'free'] },
  price: Number,
  isChap: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  pendingChanges: {
    mangaName: { type: String },
    number: { type: String },
    viporfree: { type: String },
    price: { type: String },
    content: { type: String },
    isChap: { type: Boolean }
  }
})

const Chapter = mongoose.model('chapter', chapterSchema)

module.exports = Chapter
