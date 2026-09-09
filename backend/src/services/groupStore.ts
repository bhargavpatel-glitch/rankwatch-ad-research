import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { CanonicalAd } from '../types';
import { adStore } from './adStore';

export interface AdGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  adIds: string[];
}

const GROUPS_FILE = path.resolve(__dirname, '../../../data/groups.json');

export class GroupStore {
  private groups: AdGroup[] = [];

  constructor() {
    this.loadGroups();
  }

  private loadGroups(): void {
    try {
      if (fs.existsSync(GROUPS_FILE)) {
        const raw = fs.readFileSync(GROUPS_FILE, 'utf-8');
        this.groups = JSON.parse(raw);
      } else {
        // Default initial Liked Ads group
        this.groups = [
          {
            id: 'liked',
            name: 'Liked Ads',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            adIds: []
          }
        ];
        this.saveGroups();
      }
    } catch (err) {
      console.error('[GroupStore] Error loading groups:', err);
      this.groups = [];
    }
  }

  private saveGroups(): void {
    try {
      fs.writeFileSync(GROUPS_FILE, JSON.stringify(this.groups, null, 2), 'utf-8');
    } catch (err) {
      console.error('[GroupStore] Error saving groups:', err);
    }
  }

  public getAllGroups(): AdGroup[] {
    return this.groups;
  }

  public getGroupById(id: string): AdGroup | undefined {
    return this.groups.find(g => g.id === id);
  }

  public createGroup(name: string): AdGroup {
    const cleanName = name.trim();
    const newGroup: AdGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName || 'New Group',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adIds: []
    };
    this.groups.push(newGroup);
    this.saveGroups();
    return newGroup;
  }

  public addAdsToGroup(groupId: string, adIds: string[]): AdGroup | null {
    let group = this.groups.find(g => g.id === groupId);
    if (!group) {
      // If groupId is 'liked' and not found, recreate it
      if (groupId === 'liked') {
        group = {
          id: 'liked',
          name: 'Liked Ads',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          adIds: []
        };
        this.groups.unshift(group);
      } else {
        return null;
      }
    }

    const set = new Set(group.adIds);
    for (const id of adIds) {
      if (id) set.add(id);
    }
    group.adIds = Array.from(set);
    group.updatedAt = new Date().toISOString();
    this.saveGroups();
    return group;
  }

  public removeAdFromGroup(groupId: string, adId: string): AdGroup | null {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return null;

    group.adIds = group.adIds.filter(id => id !== adId);
    group.updatedAt = new Date().toISOString();
    this.saveGroups();
    return group;
  }

  public deleteGroup(groupId: string): boolean {
    if (groupId === 'liked') return false; // Protect default group
    const initialLen = this.groups.length;
    this.groups = this.groups.filter(g => g.id !== groupId);
    if (this.groups.length !== initialLen) {
      this.saveGroups();
      return true;
    }
    return false;
  }

  public getAdsForGroup(groupId: string): CanonicalAd[] {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return [];
    return group.adIds
      .map(id => adStore.getAdById(id))
      .filter((ad): ad is CanonicalAd => !!ad);
  }
}

export const groupStore = new GroupStore();
