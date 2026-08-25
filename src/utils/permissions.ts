import { GuildMember } from 'discord.js';
import { getDatabase } from '../database/database';

export type PermissionLevel = 'justiz' | 'polizei' | 'feuerwehr' | 'rettungsdienst' | 'admin' | 'any';

interface RoleConfig {
  role_key: string;
  role_id: string;
}

function getGuildRoles(guildId: string): Map<string, string> {
  const db = getDatabase();
  const rows = db.prepare('SELECT role_key, role_id FROM role_config WHERE guild_id = ?').all(guildId) as unknown as RoleConfig[];
  const map = new Map<string, string>();
  rows.forEach(r => map.set(r.role_key, r.role_id));
  return map;
}

export function hasJustizPermission(member: GuildMember): boolean {
  const roles = getGuildRoles(member.guild.id);
  const justizRoles = ['justizLeitung', 'richter', 'staatsanwalt'];

  return justizRoles.some(key => {
    const roleId = roles.get(key);
    if (roleId) return member.roles.cache.has(roleId);
    return false;
  }) || hasAdminPermission(member);
}

export function hasAnwaltPermission(member: GuildMember): boolean {
  const roles = getGuildRoles(member.guild.id);
  const roleId = roles.get('anwalt');
  if (roleId) return member.roles.cache.has(roleId) || hasJustizPermission(member);
  return hasJustizPermission(member);
}

export function hasPolizeiPermission(member: GuildMember): boolean {
  const roles = getGuildRoles(member.guild.id);
  const polizeiRoles = ['polizeiLeitung', 'polizei', 'polizeiAnwaerter'];

  return polizeiRoles.some(key => {
    const roleId = roles.get(key);
    if (roleId) return member.roles.cache.has(roleId);
    return false;
  }) || hasAdminPermission(member);
}

export function hasFeuerwehrPermission(member: GuildMember): boolean {
  const roles = getGuildRoles(member.guild.id);
  const fwRoles = ['feuerwehrLeitung', 'feuerwehr', 'feuerwehrAnwaerter'];

  return fwRoles.some(key => {
    const roleId = roles.get(key);
    if (roleId) return member.roles.cache.has(roleId);
    return false;
  }) || hasAdminPermission(member);
}

export function hasRettungsdienstPermission(member: GuildMember): boolean {
  const roles = getGuildRoles(member.guild.id);
  const rdRoles = ['rettungsdienstLeitung', 'rettungsdienst', 'rettungsdienstAnwaerter'];

  return rdRoles.some(key => {
    const roleId = roles.get(key);
    if (roleId) return member.roles.cache.has(roleId);
    return false;
  }) || hasAdminPermission(member);
}

export function hasAdminPermission(member: GuildMember): boolean {
  if (member.permissions.has('Administrator')) return true;

  const roles = getGuildRoles(member.guild.id);
  const adminRoles = ['owner', 'coOwner', 'administrator'];

  return adminRoles.some(key => {
    const roleId = roles.get(key);
    if (roleId) return member.roles.cache.has(roleId);
    return false;
  });
}

export function hasModPermission(member: GuildMember): boolean {
  const roles = getGuildRoles(member.guild.id);
  const modRoleId = roles.get('moderator');
  if (modRoleId && member.roles.cache.has(modRoleId)) return true;
  return hasAdminPermission(member);
}
