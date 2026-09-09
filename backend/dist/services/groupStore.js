"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupStore = exports.GroupStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const adStore_1 = require("./adStore");
const GROUPS_FILE = path_1.default.resolve(__dirname, '../../../data/groups.json');
class GroupStore {
    groups = [];
    constructor() {
        this.loadGroups();
    }
    loadGroups() {
        try {
            if (fs_1.default.existsSync(GROUPS_FILE)) {
                const raw = fs_1.default.readFileSync(GROUPS_FILE, 'utf-8');
                this.groups = JSON.parse(raw);
            }
            else {
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
        }
        catch (err) {
            console.error('[GroupStore] Error loading groups:', err);
            this.groups = [];
        }
    }
    saveGroups() {
        try {
            fs_1.default.writeFileSync(GROUPS_FILE, JSON.stringify(this.groups, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[GroupStore] Error saving groups:', err);
        }
    }
    getAllGroups() {
        return this.groups;
    }
    getGroupById(id) {
        return this.groups.find(g => g.id === id);
    }
    createGroup(name) {
        const cleanName = name.trim();
        const newGroup = {
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
    addAdsToGroup(groupId, adIds) {
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
            }
            else {
                return null;
            }
        }
        const set = new Set(group.adIds);
        for (const id of adIds) {
            if (id)
                set.add(id);
        }
        group.adIds = Array.from(set);
        group.updatedAt = new Date().toISOString();
        this.saveGroups();
        return group;
    }
    removeAdFromGroup(groupId, adId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group)
            return null;
        group.adIds = group.adIds.filter(id => id !== adId);
        group.updatedAt = new Date().toISOString();
        this.saveGroups();
        return group;
    }
    deleteGroup(groupId) {
        if (groupId === 'liked')
            return false; // Protect default group
        const initialLen = this.groups.length;
        this.groups = this.groups.filter(g => g.id !== groupId);
        if (this.groups.length !== initialLen) {
            this.saveGroups();
            return true;
        }
        return false;
    }
    getAdsForGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group)
            return [];
        return group.adIds
            .map(id => adStore_1.adStore.getAdById(id))
            .filter((ad) => !!ad);
    }
}
exports.GroupStore = GroupStore;
exports.groupStore = new GroupStore();
