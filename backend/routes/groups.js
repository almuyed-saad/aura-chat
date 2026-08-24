const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { isValidObjectId } = require('../utils/validation');

const memberFor = (group, userId) => group.members.find(member => String(member.user) === String(userId));
const canManage = (group, userId) => ['owner', 'admin'].includes(memberFor(group, userId)?.role);

router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user.id })
      .populate('members.user', 'name avatar online')
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();
    res.json(groups);
  } catch (error) {
    console.error('Group list error:', error);
    res.status(500).json({ error: 'Unable to load groups' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 500) : '';
    const requestedMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Group name must be between 2 and 80 characters' });

    const memberIds = [...new Set([req.user.id, ...requestedMembers.filter(isValidObjectId).map(String)])].slice(0, 100);
    const users = await User.find({ _id: { $in: memberIds } }).select('_id');
    if (users.length !== memberIds.length) return res.status(400).json({ error: 'One or more members were not found' });

    const group = await Group.create({
      name,
      description,
      owner: req.user.id,
      members: memberIds.map(userId => ({ user: userId, role: String(userId) === String(req.user.id) ? 'owner' : 'member' }))
    });
    const populated = await Group.findById(group._id).populate('members.user', 'name avatar online').lean();
    res.status(201).json(populated);
  } catch (error) {
    console.error('Group creation error:', error);
    res.status(500).json({ error: 'Unable to create group' });
  }
});

router.get('/:groupId/messages', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.groupId)) return res.status(400).json({ error: 'Invalid group ID' });
    const group = await Group.findOne({ _id: req.params.groupId, 'members.user': req.user.id }).select('_id');
    if (!group) return res.status(403).json({ error: 'You are not a member of this group' });

    const messages = await Message.find({ group: group._id })
      .populate('sender', 'name avatar')
      .populate('replyTo', 'text sender')
      .populate('replyToSender', 'name')
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    res.json(messages.map(message => ({
      ...message,
      reactions: message.reactions instanceof Map ? Object.fromEntries(message.reactions) : message.reactions || {},
      isStarred: message.starredBy?.some(id => String(id) === String(req.user.id)) || false
    })));
  } catch (error) {
    console.error('Group messages error:', error);
    res.status(500).json({ error: 'Unable to load group messages' });
  }
});

router.post('/:groupId/members', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.body?.userId;
    if (!isValidObjectId(groupId) || !isValidObjectId(userId)) return res.status(400).json({ error: 'Invalid group or user ID' });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!canManage(group, req.user.id)) return res.status(403).json({ error: 'Only group admins can add members' });
    if (!await User.exists({ _id: userId })) return res.status(404).json({ error: 'User not found' });
    if (!memberFor(group, userId)) {
      group.members.push({ user: userId, role: 'member' });
      await group.save();
      await Notification.create({
        user: userId,
        actor: req.user.id,
        type: 'group_invite',
        text: `You were added to ${group.name}`,
        entityId: group._id,
        entityType: 'group'
      });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Add group member error:', error);
    res.status(500).json({ error: 'Unable to add group member' });
  }
});

router.patch('/:groupId/members/:userId/role', auth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const role = req.body?.role;
    if (!isValidObjectId(groupId) || !isValidObjectId(userId) || !['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role update' });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (String(group.owner) !== String(req.user.id)) return res.status(403).json({ error: 'Only the owner can change roles' });
    const target = memberFor(group, userId);
    if (!target || target.role === 'owner') return res.status(404).json({ error: 'Member not found' });
    target.role = role;
    await group.save();
    res.json({ ok: true, userId, role });
  } catch (error) {
    console.error('Group role update error:', error);
    res.status(500).json({ error: 'Unable to update member role' });
  }
});

router.delete('/:groupId/members/:userId', auth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    if (!isValidObjectId(groupId) || !isValidObjectId(userId)) return res.status(400).json({ error: 'Invalid group or user ID' });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const target = memberFor(group, userId);
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner' || !canManage(group, req.user.id) && String(userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You cannot remove this member' });
    }
    group.members = group.members.filter(member => String(member.user) !== String(userId));
    await group.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Remove group member error:', error);
    res.status(500).json({ error: 'Unable to remove group member' });
  }
});

router.patch('/:groupId', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.groupId)) return res.status(400).json({ error: 'Invalid group ID' });
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!canManage(group, req.user.id)) return res.status(403).json({ error: 'Only group admins can update the group' });
    if (typeof req.body?.name === 'string') {
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Invalid group name' });
      group.name = name;
    }
    if (typeof req.body?.description === 'string') group.description = req.body.description.trim().slice(0, 500);
    await group.save();
    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Unable to update group' });
  }
});

module.exports = { router, memberFor, canManage };
