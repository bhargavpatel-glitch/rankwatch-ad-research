import { Router, Request, Response } from 'express';
import { groupStore } from '../services/groupStore';

export const groupsRouter = Router();

// GET /api/groups - List all groups with ad counts
groupsRouter.get('/', (req: Request, res: Response) => {
  try {
    const groups = groupStore.getAllGroups();
    res.json({ groups });
  } catch (err) {
    console.error('[GroupsRouter] Error getting groups:', err);
    res.status(500).json({ error: 'Failed to retrieve groups' });
  }
});

// POST /api/groups - Create a new group
groupsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    const group = groupStore.createGroup(name);
    res.status(201).json({ group });
  } catch (err) {
    console.error('[GroupsRouter] Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// GET /api/groups/:id/ads - Get ads in group
groupsRouter.get('/:id/ads', (req: Request, res: Response) => {
  try {
    const group = groupStore.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const ads = groupStore.getAdsForGroup(req.params.id);
    res.json({ group, ads });
  } catch (err) {
    console.error('[GroupsRouter] Error getting ads for group:', err);
    res.status(500).json({ error: 'Failed to retrieve group ads' });
  }
});

// POST /api/groups/:id/ads - Add ads to group
groupsRouter.post('/:id/ads', (req: Request, res: Response) => {
  try {
    const { adIds } = req.body;
    if (!Array.isArray(adIds) || adIds.length === 0) {
      return res.status(400).json({ error: 'adIds array is required' });
    }
    const updated = groupStore.addAdsToGroup(req.params.id, adIds);
    if (!updated) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ group: updated });
  } catch (err) {
    console.error('[GroupsRouter] Error adding ads to group:', err);
    res.status(500).json({ error: 'Failed to add ads to group' });
  }
});

// DELETE /api/groups/:id/ads/:adId - Remove ad from group
groupsRouter.delete('/:id/ads/:adId', (req: Request, res: Response) => {
  try {
    const updated = groupStore.removeAdFromGroup(req.params.id, req.params.adId);
    if (!updated) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ group: updated });
  } catch (err) {
    console.error('[GroupsRouter] Error removing ad from group:', err);
    res.status(500).json({ error: 'Failed to remove ad from group' });
  }
});

// DELETE /api/groups/:id - Delete group
groupsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    if (req.params.id === 'liked') {
      return res.status(400).json({ error: 'Cannot delete the default Liked Ads group' });
    }
    const success = groupStore.deleteGroup(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[GroupsRouter] Error deleting group:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});
