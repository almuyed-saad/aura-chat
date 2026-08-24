const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  reason: { type: String, enum: ['spam', 'harassment', 'abuse', 'illegal', 'other'], required: true },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open' }
}, { timestamps: true });

ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reporter: 1, createdAt: -1 });

module.exports = mongoose.models.Report || mongoose.model('Report', ReportSchema);
